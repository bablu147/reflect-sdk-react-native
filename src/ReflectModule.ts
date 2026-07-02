// ─────────────────────────────────────────────────────────────────────────────
//  Reflect React Native SDK — high-level API over the shared ReflectCore engine.
//
//  Every call funnels through NativeReflect.handle(method, args), which maps 1:1
//  onto the native module's core.handle(...). ALL SDK logic (sessions, durable
//  queue, HMAC signing, batching, retry, dedup, device collection, deferred deep
//  links, attribution, SKAN, ATT) lives in the shared core — the SAME engine the
//  Flutter + Unity SDKs use. The only JS-side logic kept here is the client-side
//  event validation and the email/consent PII gate (there is no server-side PII
//  strip, so the gate is load-bearing).
// ─────────────────────────────────────────────────────────────────────────────

import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import NativeReflect from "./NativeReflect";
import { validateEvent } from "./EventValidator";
import type {
    ReflectConfig,
    RevenueParams,
    PurchaseParams,
    SubscriptionParams,
    AdRevenueParams,
    DeepLinkData,
    DeepLinkListener,
    AttributionListener,
    ConversionValueResult,
    PurchaseVerificationResult,
    AttributionData,
} from "./types";

// Wire-form brand stamped on sdk_version + X-Reflect-Sdk (the core defaults to the
// Flutter brand unless the host passes this). Bump in lockstep with package.json.
const RN_SDK_VERSION = "react-native-2.0.1";

let _initialized = false;
let _debug = false;
let _consentState: "granted" | "denied" = "granted";
let _email: string | null = null;
const _deepLinkListeners: Set<DeepLinkListener> = new Set();
const _attributionListeners: Set<AttributionListener> = new Set();
let _eventEmitter: NativeEventEmitter | null = null;
const _globalProperties: Record<string, unknown> = {};

function log(...args: unknown[]): void {
    if (_debug) console.log("[Reflect]", ...args);
}

// Fire-and-forget: dispatch and swallow rejections (void public methods).
function fire(method: string, args?: Record<string, unknown>): void {
    NativeReflect.handle(method, args ?? null).catch((e) => log(method + " failed:", e));
}

// Awaited dispatch for methods that return a value.
function call(method: string, args?: Record<string, unknown>): Promise<unknown> {
    return NativeReflect.handle(method, args ?? null);
}

function getEmitter(): NativeEventEmitter {
    if (!_eventEmitter) {
        _eventEmitter = new NativeEventEmitter(NativeModules.ReflectModule);
    }
    return _eventEmitter;
}

export class Reflect {
    /** Initialize the Reflect SDK. Must be called once before any other calls. */
    static initialize(config: ReflectConfig): void {
        if (_initialized) {
            log("Already initialized, ignoring duplicate call");
            return;
        }
        _debug = config.debug ?? __DEV__;
        if (config.initialConsent === "denied") _consentState = "denied";

        // Build the full core initialize arg map. baseUrl MUST be null (not "")
        // when unset — an empty string switches the core to local-only/no-network.
        const nativeConfig: Record<string, unknown> = {
            appKey: config.appKey,
            companyKey: config.companyKey ?? null,
            baseUrl: config.baseUrl ?? null,
            debug: _debug,
            signingSecret: config.signingSecret ?? null,
            environment: config.environment ?? null,
            coppaCompliant: config.coppaCompliant ?? false,
            linkMeEnabled: config.linkMeEnabled ?? false,
            requireAdvertisingConsent: config.requireAdvertisingConsent ?? false,
            requireConsent: config.requireConsent ?? false,
            initialConsent: config.initialConsent ?? null,
            existingInstallUuid: config.existingInstallUuid ?? null,
            // Brand this install as React Native (the core defaults to the Flutter
            // const otherwise — analytics would miscount RN installs as Flutter).
            sdkVersion: RN_SDK_VERSION,
        };
        // Optional numeric/behaviour knobs — only forward when the app set them so
        // the core keeps its own defaults otherwise.
        const opt = (k: keyof ReflectConfig) => {
            if (config[k] !== undefined && config[k] !== null) nativeConfig[k] = config[k];
        };
        (
            [
                "sessionThresholdSeconds",
                "batchSize",
                "maxQueueSize",
                "flushIntervalSeconds",
                "installEventTimeoutSeconds",
                "eventDeduplicationIdsMaxSize",
                "autoResolveDeferredDeepLink",
                "autoSessionTracking",
                "collectImei",
                "collectOaid",
                "autoRegisterSkan",
                "autoRequestIosTracking",
            ] as (keyof ReflectConfig)[]
        ).forEach(opt);

        fire("initialize", nativeConfig);
        _initialized = true;

        // Fan the core's deep-link + attribution streams out to JS listeners. Native
        // emits {data: <json string>} on both event names (see ReflectModule native).
        const emitter = getEmitter();
        emitter.addListener("ReflectDeepLink", (event: { data: string }) => {
            try {
                const data = JSON.parse(event.data) as DeepLinkData;
                _deepLinkListeners.forEach((fn) => fn(data));
            } catch (e) {
                log("Deep link parse error:", e);
            }
        });
        emitter.addListener("ReflectAttribution", (event: { data: string }) => {
            try {
                const data = JSON.parse(event.data) as AttributionData;
                _attributionListeners.forEach((fn) => fn(data));
            } catch (e) {
                log("Attribution parse error:", e);
            }
        });

        log("Initialized with appKey:", config.appKey);
    }

    /** Track a named event with optional properties. Client-side validated. */
    static trackEvent(eventName: string, properties?: Record<string, unknown>): void {
        if (!_initialized) {
            log("Not initialized, dropping event:", eventName);
            return;
        }
        const result = validateEvent(eventName, properties);
        if (!result.valid) {
            log("Event validation failed:", result.error);
            return;
        }
        // Merge global properties (event props override) + attach consent_state.
        // Attach the sticky email only when consent is not "denied" (load-bearing
        // gate — there is no server-side PII strip). Per-event props override it.
        const merged = {
            ..._globalProperties,
            ...(_email && _consentState !== "denied" ? { email: _email } : {}),
            ...(result.cleaned ?? properties),
            consent_state: _consentState,
        };
        fire("trackEvent", { eventName, properties: JSON.stringify(merged) });
        log("trackEvent:", eventName);
    }

    /** Track a revenue event. */
    static trackRevenue(params: RevenueParams): void {
        if (!_initialized) return;
        fire("trackRevenue", {
            amount: params.amount,
            currency: params.currency,
            transactionId: params.transactionId ?? null,
            productId: params.productId ?? null,
            revenueType: params.revenueType ?? null,
        });
        log("trackRevenue:", params);
    }

    /** Track a purchase — routed to the core's real purchase handler (receipt
     *  validation + client-side dedup). */
    static trackPurchase(params: PurchaseParams): void {
        if (!_initialized) return;
        fire("trackPurchase", Reflect.purchaseArgs(params));
    }

    /** Track a subscription. */
    static trackSubscription(params: SubscriptionParams): void {
        if (!_initialized) return;
        fire("trackSubscription", {
            ...Reflect.purchaseArgs(params),
            isTrial: params.isTrial ?? false,
        });
    }

    /** Track mediation ad revenue (impression-level). */
    static trackAdRevenue(params: AdRevenueParams): void {
        if (!_initialized) return;
        fire("trackAdRevenue", {
            revenue: params.revenue,
            currency: params.currency,
            impressions: params.impressions ?? 1,
            source: params.source ?? null,
            adNetwork: params.adNetwork ?? null,
            adUnit: params.adUnit ?? null,
            adPlacement: params.adPlacement ?? null,
            adFormat: params.adFormat ?? null,
            precision: params.precision ?? null,
        });
    }

    /** Verify a purchase server-side (Apple/Google receipt validation). */
    static async verifyPurchase(params: PurchaseParams): Promise<PurchaseVerificationResult> {
        const raw = await call("verifyPurchase", Reflect.purchaseArgs(params));
        return Reflect.parseJson<PurchaseVerificationResult>(raw) ?? { status: "not_verified", code: "parse_error" };
    }

    /** Set the user ID for cross-device attribution. */
    static setUserId(userId: string): void {
        if (!_initialized) return;
        fire("setUserId", { userId });
        log("setUserId:", userId);
    }

    /** Clear the user ID (e.g., on logout). */
    static clearUserId(): void {
        if (!_initialized) return;
        fire("clearUserId");
        log("clearUserId");
    }

    /**
     * Set the user's raw email. Attached as `email` to every future event (unless
     * consent is "denied") and hashed server-side. Routed purely through the JS
     * property merge — the PII gate must stay client-side.
     */
    static setEmail(email: string): void {
        _email = email;
        log("setEmail");
    }

    /** Clear the sticky email (e.g., on logout). */
    static clearEmail(): void {
        _email = null;
        log("clearEmail");
    }

    /** Set user-level properties that attach to all future events. */
    static setUserProperties(properties: Record<string, unknown>): void {
        if (!_initialized) return;
        fire("setUserProperties", { properties: JSON.stringify(properties) });
        log("setUserProperties:", properties);
    }

    /** Set a global property merged into every event. Per-event props override. */
    static setGlobalProperty(key: string, value: unknown): void {
        _globalProperties[key] = value;
        log("setGlobalProperty:", key, value);
    }

    /** Remove a single global property. */
    static unsetGlobalProperty(key: string): void {
        delete _globalProperties[key];
        log("unsetGlobalProperty:", key);
    }

    /** Remove all global properties. */
    static clearGlobalProperties(): void {
        for (const key of Object.keys(_globalProperties)) delete _globalProperties[key];
        log("clearGlobalProperties");
    }

    /** Tag the current install with audience labels for segmentation. */
    static setAudience(...tags: string[]): void {
        if (!_initialized) return;
        fire("setAudience", { tags });
        log("setAudience:", tags);
    }

    /**
     * Set the user's data-collection consent. Attached to every event as
     * `consent_state`, and forwarded to the core (which flushes / re-collects the
     * advertising id on grant).
     */
    static setConsent(granted: boolean): void {
        _consentState = granted ? "granted" : "denied";
        fire("setConsent", { granted });
        log("setConsent:", _consentState);
    }

    /** Returns the current consent state — "granted" or "denied" (JS mirror). */
    static getConsent(): string {
        return _consentState;
    }

    /** Grant or revoke advertising ID (IDFA/GAID) consent. */
    static setAdvertisingConsent(granted: boolean): void {
        if (!_initialized) return;
        fire("setAdvertisingConsent", { granted });
        log("setAdvertisingConsent:", granted);
    }

    /** Opt the user in/out of third-party data sharing (sent on every event). */
    static setThirdPartySharing(enabled: boolean): void {
        if (!_initialized) return;
        fire("setThirdPartySharing", { enabled });
    }

    /** Set a per-partner sharing flag/value. */
    static setPartnerSharing(partner: string, key: string, value: unknown): void {
        if (!_initialized) return;
        fire("setPartnerSharing", { partner, key, value });
    }

    /** Set an external device id (cross-system join key). */
    static setExternalDeviceId(externalDeviceId: string): void {
        if (!_initialized) return;
        fire("setExternalDeviceId", { externalDeviceId });
    }

    /** Set a partner parameter forwarded on postbacks. */
    static setPartnerParameter(key: string, value: string): void {
        if (!_initialized) return;
        fire("setPartnerParameter", { key, value });
    }

    /** Remove a single partner parameter. */
    static unsetPartnerParameter(key: string): void {
        if (!_initialized) return;
        fire("unsetPartnerParameter", { key });
    }

    /** Remove all partner parameters. */
    static clearPartnerParameters(): void {
        if (!_initialized) return;
        fire("clearPartnerParameters");
    }

    /** Toggle offline mode (queue but never send until re-enabled). */
    static setOfflineMode(offline: boolean): void {
        if (!_initialized) return;
        fire("setOfflineMode", { offline });
    }

    /** Set the Play Integrity / DeviceCheck token (anti-fraud). */
    static setIntegrityToken(token: string): void {
        if (!_initialized) return;
        fire("setIntegrityToken", { token });
    }

    /** Set a push token (sticky, no event — use registerPushToken to also emit one). */
    static setPushToken(token: string): void {
        if (!_initialized) return;
        fire("setPushToken", { token });
    }

    /** Register a push token with the server (emits a _push_token event). */
    static registerPushToken(token: string, provider?: string): void {
        if (!_initialized) return;
        const resolved = provider ?? (Platform.OS === "ios" ? "apns" : "fcm");
        fire("registerPushToken", { token, provider: resolved });
        log("registerPushToken:", resolved);
    }

    /** Get the persistent install UUID assigned by Reflect. */
    static async getInstallUuid(): Promise<string> {
        const v = await call("getInstallUuid");
        return typeof v === "string" ? v : "";
    }

    /** Whether the SDK is currently enabled. */
    static async isEnabled(): Promise<boolean> {
        return (await call("isEnabled")) === true;
    }

    /** Get the current attribution data (may be null if not yet attributed). */
    static async getAttribution(): Promise<AttributionData | null> {
        return Reflect.parseJson<AttributionData>(await call("getAttribution"));
    }

    /**
     * Get attribution, waiting up to timeoutMs for a fresh /attribution/check
     * before falling back to the cached value.
     */
    static async getAttributionWithTimeout(timeoutMs = 3000): Promise<AttributionData | null> {
        return Reflect.parseJson<AttributionData>(await call("getAttributionWithTimeout", { timeoutMs }));
    }

    /** Register a listener for attribution-change events. Returns an unsubscribe fn. */
    static onAttribution(listener: AttributionListener): () => void {
        _attributionListeners.add(listener);
        return () => {
            _attributionListeners.delete(listener);
        };
    }

    /** Update the SKAN conversion value (iOS only). No-op on Android. */
    static async updateConversionValue(
        fineValue: number,
        coarseValue?: string,
        lockWindow?: boolean,
    ): Promise<ConversionValueResult> {
        if (Platform.OS !== "ios") return { success: true };
        const raw = await call("updateConversionValue", {
            fineValue,
            coarseValue: coarseValue ?? null,
            lockWindow: lockWindow ?? false,
        });
        return Reflect.parseJson<ConversionValueResult>(raw) ?? { success: false, error: "parse_error" };
    }

    /** Present the iOS App Tracking Transparency prompt. Returns the status string
     *  ("authorized"/"denied"/…); "unavailable" on Android. */
    static async requestIosTracking(): Promise<string> {
        const v = await call("requestIosTracking");
        return typeof v === "string" ? v : "unavailable";
    }

    /** Register a listener for deep link events. Returns an unsubscribe function. */
    static onDeepLink(listener: DeepLinkListener): () => void {
        _deepLinkListeners.add(listener);
        return () => {
            _deepLinkListeners.delete(listener);
        };
    }

    /** Get the deep link that opened the app (if any). */
    static async getInitialDeepLink(): Promise<DeepLinkData | null> {
        return Reflect.parseJson<DeepLinkData>(await call("getInitialDeepLink"));
    }

    /** Get the last deep link the SDK processed (if any). */
    static async getLastDeepLink(): Promise<DeepLinkData | null> {
        return Reflect.parseJson<DeepLinkData>(await call("getLastDeepLink"));
    }

    /** Resolve/unshorten a Reflect branded link to its destination URL. */
    static async resolveDeepLink(url: string): Promise<string | null> {
        const v = await call("resolveDeepLink", { url });
        return typeof v === "string" ? v : null;
    }

    /** Feed a URL captured via RN Linking into the core's deep-link pipeline. */
    static handleDeepLink(url: string): void {
        if (!_initialized) return;
        fire("handleDeepLink", { url });
    }

    /** GDPR — delete all user data (local wipe + suppression + server request). */
    static async deleteUserData(): Promise<boolean> {
        if (!_initialized) return false;
        try {
            await call("deleteUserData");
            _email = null; // drop the sticky email so a deleted user's address can't ride on later events
            return true;
        } catch {
            return false;
        }
    }

    /** Enable or disable the SDK at runtime. */
    static setEnabled(enabled: boolean): void {
        fire("setEnabled", { enabled });
        log("setEnabled:", enabled);
    }

    /** Force-flush any buffered events. */
    static flush(): void {
        if (!_initialized) return;
        fire("flush");
        log("flush");
    }

    /** Diagnostics snapshot from the core (queue depth, session, install state). */
    static async getDebugState(): Promise<Record<string, unknown> | null> {
        return Reflect.parseJson<Record<string, unknown>>(await call("getDebugState"));
    }

    // ── internal helpers ──────────────────────────────────────────────────────

    private static purchaseArgs(params: PurchaseParams): Record<string, unknown> {
        return {
            productId: params.productId,
            price: params.price,
            currency: params.currency,
            transactionId: params.transactionId ?? null,
            receiptData: params.receiptData ?? null,
            purchaseToken: params.purchaseToken ?? null,
            orderId: params.orderId ?? null,
            signature: params.signature ?? null,
            salesRegion: params.salesRegion ?? null,
            deduplicationId: params.deduplicationId ?? null,
            extraProperties: params.extraProperties ?? null,
        };
    }

    private static parseJson<T>(raw: unknown): T | null {
        if (typeof raw !== "string" || raw.length === 0) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }
}
