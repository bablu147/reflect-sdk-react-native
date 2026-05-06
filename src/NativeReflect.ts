// ─────────────────────────────────────────────────────────────────────────────
//  TurboModule spec for Reflect native module.
//  This defines the bridge interface between JS and native code.
//  Compatible with both Old Architecture (Bridge) and New Architecture (JSI).
// ─────────────────────────────────────────────────────────────────────────────

import { NativeModules, Platform } from "react-native";

export interface NativeReflectSpec {
    /** Initialize the SDK with config JSON. Must be called first. */
    initialize(configJson: string): void;

    /** Track an event with optional properties JSON. */
    trackEvent(eventName: string, propertiesJson: string | null): void;

    /** Track a revenue event. */
    trackRevenue(
        amount: number,
        currency: string,
        transactionId: string | null,
        productId: string | null,
        revenueType: string | null,
    ): void;

    /** Set a user ID for cross-device attribution. */
    setUserId(userId: string): void;

    /** Clear user ID (e.g., on logout). */
    clearUserId(): void;

    /** Set user-level properties. */
    setUserProperties(propertiesJson: string): void;

    /** Grant or revoke advertising ID consent. */
    setAdvertisingConsent(granted: boolean): void;

    /** Get the current install UUID. Returns a promise. */
    getInstallUuid(): Promise<string>;

    /** Get attribution data. Returns JSON string or null. */
    getAttribution(): Promise<string | null>;

    /** Update SKAN conversion value (iOS only). */
    updateConversionValue(
        fineValue: number,
        coarseValue: string | null,
        lockWindow: boolean,
    ): Promise<string>;

    /** Register for deep link callbacks. Returns the initial deep link if any. */
    getInitialDeepLink(): Promise<string | null>;

    /** Enable/disable SDK. */
    setEnabled(enabled: boolean): void;

    /** Flush pending events immediately. */
    flush(): void;
}

const LINKING_ERROR =
    `The package '@reflect-sdk/react-native' doesn't seem to be linked. Make sure:\n\n` +
    Platform.select({
        ios: "- You ran 'pod install' in the ios/ directory\n",
        default: "",
    }) +
    "- You rebuilt the app after installing the package\n" +
    "- You are not using Expo Go (use a development build instead)\n";

const NativeReflect: NativeReflectSpec = NativeModules.ReflectModule
    ? NativeModules.ReflectModule
    : new Proxy({} as NativeReflectSpec, {
          get() {
              throw new Error(LINKING_ERROR);
          },
      });

export default NativeReflect;
