// ─────────────────────────────────────────────────────────────────────────────
//  Reflect React Native SDK — TypeScript types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration passed to Reflect.initialize(). The core ignores fields that
 * don't apply to the running platform (e.g. collectImei is Android-only,
 * autoRegisterSkan is iOS-only), so a single config object is portable.
 */
export interface ReflectConfig {
    /** Your app's unique key (from the Reflect admin panel). */
    appKey: string;
    /** Company key for multi-tenant setups. Optional. */
    companyKey?: string;
    /** Override the default ingestion endpoint. Leave unset to use production. */
    baseUrl?: string;
    /** Enable debug logging to console. Default: false in release, true in __DEV__. */
    debug?: boolean;
    /** HMAC secret for request signing (anti-fraud). Optional. */
    signingSecret?: string;
    /** "production" | "sandbox". */
    environment?: string;
    /** COPPA mode — suppresses advertising IDs + forces third-party-sharing off. */
    coppaCompliant?: boolean;
    /** Enable Adjust-style LinkMe clipboard deferred deep linking. */
    linkMeEnabled?: boolean;
    /** If true, no IDFA/GAID until setAdvertisingConsent(true). */
    requireAdvertisingConsent?: boolean;
    /** If true, hold all events until setConsent(true) (CMP-gated apps). */
    requireConsent?: boolean;
    /** Initial consent when requireConsent is set. "granted" | "denied". */
    initialConsent?: string;
    /** Adopt an existing install_uuid (migration continuity). Advanced. */
    existingInstallUuid?: string;
    /** Seconds of background before a new session is counted. */
    sessionThresholdSeconds?: number;
    /** Max events per ingest batch. */
    batchSize?: number;
    /** Max durable-queue size before oldest events drop. */
    maxQueueSize?: number;
    /** Periodic flush interval (seconds). */
    flushIntervalSeconds?: number;
    /** Seconds to wait for install signals before firing app_install. */
    installEventTimeoutSeconds?: number;
    /** LRU size for client-side dedup ids. */
    eventDeduplicationIdsMaxSize?: number;
    /** Auto-resolve the deferred deep link on first launch. Default: true. */
    autoResolveDeferredDeepLink?: boolean;
    /** Auto session tracking. Default: true. */
    autoSessionTracking?: boolean;
    /** Android — collect IMEI (requires permission; rarely used). */
    collectImei?: boolean;
    /** Android — collect OAID (Huawei/Chinese stores). */
    collectOaid?: boolean;
    /** iOS — auto-register for SKAdNetwork on init. */
    autoRegisterSkan?: boolean;
    /** iOS — auto-present the ATT prompt on init. */
    autoRequestIosTracking?: boolean;
}

/** Revenue event parameters. */
export interface RevenueParams {
    /** Revenue amount (e.g., 4.99). */
    amount: number;
    /** ISO 4217 currency code (e.g., "USD"). */
    currency: string;
    /** Receipt or transaction ID for server-side validation. */
    transactionId?: string;
    /** Product identifier. */
    productId?: string;
    /** "purchase" | "subscription" | "ad_revenue". */
    revenueType?: string;
}

/** Purchase event parameters (routed to the core's real purchase handler — receipt
 *  validation + client-side dedup). */
export interface PurchaseParams {
    productId: string;
    price: number;
    currency: string;
    transactionId?: string;
    /** iOS App Store receipt (base64). */
    receiptData?: string;
    /** Android Play purchase token. */
    purchaseToken?: string;
    /** Android order id. */
    orderId?: string;
    /** Android purchase signature. */
    signature?: string;
    /** Sales region / storefront. */
    salesRegion?: string;
    /** Explicit dedup key (defaults to purchaseToken ?? transactionId). */
    deduplicationId?: string;
    extraProperties?: Record<string, unknown>;
}

/** Subscription event parameters. */
export interface SubscriptionParams {
    productId: string;
    price: number;
    currency: string;
    transactionId?: string;
    isTrial?: boolean;
    receiptData?: string;
    purchaseToken?: string;
    orderId?: string;
    signature?: string;
    salesRegion?: string;
    deduplicationId?: string;
    extraProperties?: Record<string, unknown>;
}

/** Ad-revenue event parameters (mediation impression-level revenue). */
export interface AdRevenueParams {
    /** Revenue amount. */
    revenue: number;
    /** ISO 4217 currency code. */
    currency: string;
    /** Impression count (min 1). */
    impressions?: number;
    /** Mediation source (e.g. "applovin_max", "admob"). */
    source?: string;
    /** Ad network that filled. */
    adNetwork?: string;
    /** Ad unit id. */
    adUnit?: string;
    /** Ad placement. */
    adPlacement?: string;
    /** Ad format (banner/interstitial/rewarded/native). */
    adFormat?: string;
    /** "publisher_defined" | "estimated" | "exact". Default: "estimated". */
    precision?: string;
}

/** Deep link data received on app open. */
export interface DeepLinkData {
    /** The full URL that opened the app. */
    url: string;
    /** Parsed path (e.g., "/promo/summer"). */
    path: string | null;
    /** Parsed query parameters. */
    params: Record<string, string>;
    /** The click_id if this was a Reflect tracking link. */
    clickId: string | null;
    /** Campaign name from tracking link. */
    campaign: string | null;
    /** Partner slug from tracking link. */
    partner: string | null;
    /** Whether this is a deferred deep link (resolved after install). */
    isDeferred: boolean;
}

/** Conversion value update result (SKAN). */
export interface ConversionValueResult {
    success: boolean;
    error?: string;
}

/** Server-side purchase verification result. */
export interface PurchaseVerificationResult {
    status: string;
    code?: string;
    message?: string;
}

/** Attribution data returned by getAttribution(). */
export interface AttributionData {
    /** "deterministic" | "fingerprint" | "organic" | "san" */
    type: string | null;
    /** Partner slug (e.g., "meta", "tiktok"). */
    partner: string | null;
    /** Campaign name. */
    campaign: string | null;
    /** Click ID. */
    clickId: string | null;
    /** Ad group name. */
    adGroup: string | null;
    /** Creative/ad name. */
    creative: string | null;
}

/** Listener for deep link events. */
export type DeepLinkListener = (data: DeepLinkData) => void;

/** Listener for attribution-change events. */
export type AttributionListener = (data: AttributionData) => void;
