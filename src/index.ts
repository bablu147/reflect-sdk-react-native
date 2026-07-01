// ─────────────────────────────────────────────────────────────────────────────
//  @reflect-sdk/react-native — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { Reflect } from "./ReflectModule";

export {
    StandardEventNames,
    signUpWith,
    loginWith,
    tutorialCompleted,
    levelStarted,
    levelAchieved,
    levelCompleted,
    achievement,
    viewItem,
    searchPerformed,
    shared,
    rated,
    addedToCart,
    checkoutBegan,
    trialStarted,
    trialConvertedTo,
    subscriptionDidRenew,
    subscriptionDidCancel,
    subscriptionDidRefund,
    adShown,
    adClicked,
} from "./StandardEvents";

export { validateEvent } from "./EventValidator";
export type { ValidationResult } from "./EventValidator";

export type {
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
