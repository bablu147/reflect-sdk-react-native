// ─────────────────────────────────────────────────────────────────────────────
//  Reflect React Native SDK — TypeScript types
// ─────────────────────────────────────────────────────────────────────────────

/** Configuration passed to Reflect.initialize(). */
export interface ReflectConfig {
    /** Your app's unique key (from the Reflect admin panel). */
    appKey: string;
    /** Company key for multi-tenant setups. Optional. */
    companyKey?: string;
    /** Override the default ingestion endpoint. */
    baseUrl?: string;
    /** Enable debug logging to console. Default: false in release, true in __DEV__. */
    debug?: boolean;
    /** If true, SDK won't collect IDFA/GAID until setAdvertisingConsent(true). */
    requireAdvertisingConsent?: boolean;
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
