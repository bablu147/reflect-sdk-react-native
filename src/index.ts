// ─────────────────────────────────────────────────────────────────────────────
//  @reflect-sdk/react-native — Public API
//
//  Usage:
//    import { Reflect } from '@reflect-sdk/react-native';
//
//    Reflect.initialize({ appKey: 'YOUR_APP_KEY' });
//    Reflect.trackEvent('level_complete', { level: 5 });
//    Reflect.trackRevenue({ amount: 4.99, currency: 'USD' });
// ─────────────────────────────────────────────────────────────────────────────

export { Reflect } from "./ReflectModule";

export type {
    ReflectConfig,
    RevenueParams,
    DeepLinkData,
    DeepLinkListener,
    ConversionValueResult,
    AttributionData,
} from "./types";
