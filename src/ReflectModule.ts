// ─────────────────────────────────────────────────────────────────────────────
//  Reflect React Native SDK — high-level wrapper around the native module.
// ─────────────────────────────────────────────────────────────────────────────

import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import NativeReflect from "./NativeReflect";
import { validateEvent } from "./EventValidator";
import type {
    ReflectConfig,
    RevenueParams,
    PurchaseParams,
    SubscriptionParams,
    DeepLinkData,
    DeepLinkListener,
    ConversionValueResult,
    AttributionData,
} from "./types";

let _initialized = false;
let _debug = false;
const _deepLinkListeners: Set<DeepLinkListener> = new Set();
let _eventEmitter: NativeEventEmitter | null = null;
const _globalProperties: Record<string, unknown> = {};

function log(...args: unknown[]): void {
    if (_debug) console.log("[Reflect]", ...args);
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

        const nativeConfig = {
            appKey: config.appKey,
            companyKey: config.companyKey ?? null,
            baseUrl: config.baseUrl ?? null,
            debug: _debug,
            requireAdvertisingConsent: config.requireAdvertisingConsent ?? false,
        };

        NativeReflect.initialize(JSON.stringify(nativeConfig));
        _initialized = true;

        const emitter = getEmitter();
        emitter.addListener("ReflectDeepLink", (event: { data: string }) => {
            try {
                const data = JSON.parse(event.data) as DeepLinkData;
                _deepLinkListeners.forEach((fn) => fn(data));
            } catch (e) {
                log("Deep link parse error:", e);
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
        // Merge global properties (event props override)
        const merged = { ..._globalProperties, ...(result.cleaned ?? properties) };
        const json = Object.keys(merged).length > 0 ? JSON.stringify(merged) : null;
        NativeReflect.trackEvent(eventName, json);
        log("trackEvent:", eventName);
    }

    /** Track a revenue event. */
    static trackRevenue(params: RevenueParams): void {
        if (!_initialized) return;
        NativeReflect.trackRevenue(
            params.amount,
            params.currency,
            params.transactionId ?? null,
            params.productId ?? null,
            params.revenueType ?? null,
        );
        log("trackRevenue:", params);
    }

    /** Track a purchase event with optional receipt data for server validation. */
    static trackPurchase(params: PurchaseParams): void {
        if (!_initialized) return;
        const props: Record<string, unknown> = {
            product_id: params.productId,
            price: params.price,
            currency: params.currency,
            ...(params.transactionId ? { transaction_id: params.transactionId } : undefined),
            ...(params.receiptData ? { receipt_data: params.receiptData } : undefined),
            ...params.extraProperties,
        };
        Reflect.trackEvent("purchase", props);
    }

    /** Track a subscription event. */
    static trackSubscription(params: SubscriptionParams): void {
        if (!_initialized) return;
        const props: Record<string, unknown> = {
            product_id: params.productId,
            price: params.price,
            currency: params.currency,
            is_trial: params.isTrial ?? false,
            ...(params.transactionId ? { transaction_id: params.transactionId } : undefined),
            ...(params.receiptData ? { receipt_data: params.receiptData } : undefined),
            ...params.extraProperties,
        };
        Reflect.trackEvent("subscribe", props);
    }

    /** Set the user ID for cross-device attribution. */
    static setUserId(userId: string): void {
        if (!_initialized) return;
        NativeReflect.setUserId(userId);
        log("setUserId:", userId);
    }

    /** Clear the user ID (e.g., on logout). */
    static clearUserId(): void {
        if (!_initialized) return;
        NativeReflect.clearUserId();
        log("clearUserId");
    }

    /** Set user-level properties that attach to all future events. */
    static setUserProperties(properties: Record<string, unknown>): void {
        if (!_initialized) return;
        NativeReflect.setUserProperties(JSON.stringify(properties));
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
        for (const key of Object.keys(_globalProperties)) {
            delete _globalProperties[key];
        }
        log("clearGlobalProperties");
    }

    /** Tag the current install with audience labels for segmentation. */
    static setAudience(...tags: string[]): void {
        if (!_initialized) return;
        NativeReflect.trackEvent("_set_audience", JSON.stringify({ tags }));
        log("setAudience:", tags);
    }

    /** Grant or revoke advertising ID (IDFA/GAID) consent. */
    static setAdvertisingConsent(granted: boolean): void {
        if (!_initialized) return;
        NativeReflect.setAdvertisingConsent(granted);
        log("setAdvertisingConsent:", granted);
    }

    /** Get the persistent install UUID assigned by Reflect. */
    static async getInstallUuid(): Promise<string> {
        return NativeReflect.getInstallUuid();
    }

    /** Get the current attribution data (may be null if not yet attributed). */
    static async getAttribution(): Promise<AttributionData | null> {
        const json = await NativeReflect.getAttribution();
        if (!json) return null;
        try {
            return JSON.parse(json) as AttributionData;
        } catch {
            return null;
        }
    }

    /** Update the SKAN conversion value (iOS only). No-op on Android. */
    static async updateConversionValue(
        fineValue: number,
        coarseValue?: string,
        lockWindow?: boolean,
    ): Promise<ConversionValueResult> {
        if (Platform.OS !== "ios") {
            return { success: true };
        }
        const json = await NativeReflect.updateConversionValue(
            fineValue,
            coarseValue ?? null,
            lockWindow ?? false,
        );
        try {
            return JSON.parse(json) as ConversionValueResult;
        } catch {
            return { success: false, error: "parse_error" };
        }
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
        const json = await NativeReflect.getInitialDeepLink();
        if (!json) return null;
        try {
            return JSON.parse(json) as DeepLinkData;
        } catch {
            return null;
        }
    }

    /**
     * GDPR — delete all user data. Clears local state and sends a
     * deletion request to the server.
     */
    static async deleteUserData(): Promise<boolean> {
        if (!_initialized) return false;
        const json = await NativeReflect.deleteUserData();
        try {
            const result = JSON.parse(json);
            return result.success === true;
        } catch {
            return false;
        }
    }

    /** Enable or disable the SDK at runtime. */
    static setEnabled(enabled: boolean): void {
        NativeReflect.setEnabled(enabled);
        log("setEnabled:", enabled);
    }

    /** Force-flush any buffered events. */
    static flush(): void {
        if (!_initialized) return;
        NativeReflect.flush();
        log("flush");
    }
}
