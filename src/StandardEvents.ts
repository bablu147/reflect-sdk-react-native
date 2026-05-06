// ─────────────────────────────────────────────────────────────────────────────
//  Standard event names and typed helpers for the Reflect SDK.
//  Matches the MMP taxonomy used by AppsFlyer, Adjust, and Firebase Analytics.
// ─────────────────────────────────────────────────────────────────────────────

import { Reflect } from "./ReflectModule";

// ── Event name constants ────────────────────────────────────────────────────

export const StandardEventNames = {
    // Lifecycle
    AppInstall: "app_install",
    AppOpen: "app_open",
    AppFirstOpen: "app_first_open",
    SessionStart: "session_start",
    SessionEnd: "session_end",
    // Identity
    SignUp: "sign_up",
    Login: "login",
    // Onboarding
    TutorialBegin: "tutorial_begin",
    TutorialComplete: "tutorial_complete",
    // Progression
    LevelStart: "level_start",
    LevelUp: "level_up",
    LevelComplete: "level_complete",
    AchievementUnlocked: "achievement_unlocked",
    // Content
    ViewItem: "view_item",
    Search: "search",
    Share: "share",
    Rate: "rate",
    // Commerce
    AddToCart: "add_to_cart",
    BeginCheckout: "begin_checkout",
    Purchase: "purchase",
    Subscribe: "subscribe",
    StartTrial: "start_trial",
    TrialConverted: "trial_converted",
    SubscriptionRenewed: "subscription_renewed",
    SubscriptionCancelled: "subscription_cancelled",
    SubscriptionRefunded: "subscription_refunded",
    // Advertising
    AdImpression: "ad_impression",
    AdClick: "ad_click",
} as const;

// ── Typed helper functions ──────────────────────────────────────────────────

type Props = Record<string, unknown>;

export function signUpWith(method: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.SignUp, { method, ...extra });
}

export function loginWith(method: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.Login, { method, ...extra });
}

export function tutorialCompleted(step?: number, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.TutorialComplete, {
        ...(step != null ? { step } : undefined),
        ...extra,
    });
}

export function levelStarted(level: number, score?: number, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.LevelStart, {
        level,
        ...(score != null ? { score } : undefined),
        ...extra,
    });
}

export function levelAchieved(level: number, score?: number, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.LevelUp, {
        level,
        ...(score != null ? { score } : undefined),
        ...extra,
    });
}

export function levelCompleted(level: number, score?: number, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.LevelComplete, {
        level,
        ...(score != null ? { score } : undefined),
        ...extra,
    });
}

export function achievement(achievementId: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.AchievementUnlocked, { achievement_id: achievementId, ...extra });
}

export function viewItem(contentType: string, itemId: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.ViewItem, { content_type: contentType, item_id: itemId, ...extra });
}

export function searchPerformed(query: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.Search, { query, ...extra });
}

export function shared(contentType: string, itemId: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.Share, { content_type: contentType, item_id: itemId, ...extra });
}

export function rated(rating: number, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.Rate, { rating, ...extra });
}

export function addedToCart(sku: string, price: number, currency: string, quantity = 1, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.AddToCart, { sku, price, currency, quantity, ...extra });
}

export function checkoutBegan(cartValue: number, currency: string, itemCount?: number, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.BeginCheckout, {
        cart_value: cartValue,
        currency,
        ...(itemCount != null ? { item_count: itemCount } : undefined),
        ...extra,
    });
}

export function trialStarted(productId: string, price: number, currency: string, transactionId?: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.StartTrial, {
        product_id: productId, price, currency,
        ...(transactionId ? { transaction_id: transactionId } : undefined),
        ...extra,
    });
}

export function trialConvertedTo(productId: string, price: number, currency: string, transactionId?: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.TrialConverted, {
        product_id: productId, price, currency,
        ...(transactionId ? { transaction_id: transactionId } : undefined),
        ...extra,
    });
}

export function subscriptionDidRenew(productId: string, price: number, currency: string, transactionId?: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.SubscriptionRenewed, {
        product_id: productId, price, currency,
        ...(transactionId ? { transaction_id: transactionId } : undefined),
        ...extra,
    });
}

export function subscriptionDidCancel(productId: string, reason?: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.SubscriptionCancelled, {
        product_id: productId,
        ...(reason ? { reason } : undefined),
        ...extra,
    });
}

export function subscriptionDidRefund(productId: string, amount: number, currency: string, transactionId?: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.SubscriptionRefunded, {
        product_id: productId, amount, currency,
        ...(transactionId ? { transaction_id: transactionId } : undefined),
        ...extra,
    });
}

export function adShown(adNetwork: string, adFormat: string, revenue?: number, currency?: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.AdImpression, {
        ad_network: adNetwork, ad_format: adFormat,
        ...(revenue != null ? { revenue } : undefined),
        ...(currency ? { currency } : undefined),
        ...extra,
    });
}

export function adClicked(adNetwork: string, adFormat: string, extra?: Props): void {
    Reflect.trackEvent(StandardEventNames.AdClick, { ad_network: adNetwork, ad_format: adFormat, ...extra });
}
