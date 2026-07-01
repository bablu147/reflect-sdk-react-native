# @reflect-sdk/react-native

Reflect MMP SDK for React Native — mobile attribution, event tracking, deep
linking, and SKAdNetwork/AdAttributionKit.

**Architecture (v2):** a thin JS + native bridge over the **shared `ReflectCore`
engine** — the exact same Kotlin (`reflect-android`) and Swift (`reflect-ios`)
native core the Reflect Flutter and Unity SDKs use. All SDK logic (sessions,
durable queue, **HMAC-signed ingest**, batching, response-driven retry, client-side
dedup, device signals, deferred deep links, attribution, SKAN, ATT) lives in the
core; this package only translates the RN bridge onto `core.handle(...)`. (v1 was a
standalone re-implementation that posted **unsigned** events — v2 is a breaking
native rewrite; the public JS API stays backward-compatible and gains new methods.)

## Install

```sh
npm install github:bablu147/reflect-sdk-react-native
# or
yarn add github:bablu147/reflect-sdk-react-native
```

This is an autolinked native module. After installing, rebuild your app:

```sh
cd ios && pod install && cd ..   # iOS only
npx react-native run-ios         # or run-android
```

Requires `react >= 18.0.0` and `react-native >= 0.71.0`.

## Quick start

Call `initialize` once, as early as possible in your app's lifecycle (e.g. in
your root component or `index.js`). An `app_open` event is sent automatically on
init.

```ts
import { Reflect } from "@reflect-sdk/react-native";

Reflect.initialize({
    appKey: "your-app-key",
    // companyKey: "acme",                // optional, multi-tenant setups
    // baseUrl: "https://api.reflect.cloud", // optional, override endpoint
    // debug: true,                       // optional, console logging
    // requireAdvertisingConsent: true,   // optional, withhold IDFA/GAID until granted
});
```

Track named events with optional properties (validated client-side):

```ts
Reflect.trackEvent("level_completed", { level: 7, score: 42000 });
Reflect.trackEvent("tutorial_finished");
```

Revenue and purchases:

```ts
Reflect.trackRevenue({ amount: 4.99, currency: "USD", productId: "coins_500" });
```

## Identify API — setEmail / clearEmail

`setEmail(email)` associates a raw email address with the current install for
email-attribution and better Conversions API (CAPI) match quality. The address
is attached as `email` to every subsequent event and **hashed server-side** — you
pass the **raw** email, never a hash.

```ts
// After the user logs in or provides their email:
Reflect.setEmail("user@example.com");

// On logout:
Reflect.clearEmail();
```

Consent gating is load-bearing: the email is attached **only when consent is not
denied**. If you call `Reflect.setConsent(false)`, no `email` is sent on any
event until consent is granted again — even if `setEmail` was already called.

```ts
Reflect.setConsent(false);            // consent_state: "denied"
Reflect.setEmail("user@example.com"); // stored, but NOT attached while denied
Reflect.trackEvent("checkout");       // no email on this event

Reflect.setConsent(true);             // consent_state: "granted"
Reflect.trackEvent("purchase");       // email now attached + hashed server-side
```

Notes:

- The email is sticky — it rides on every event until you `clearEmail()`.
- Per-event properties override it, so passing `email` in a `trackEvent` call
  takes precedence for that event.
- `deleteUserData()` clears the sticky email as part of GDPR cleanup.

## Deep links (native wiring)

**Android** — no wiring needed for standard `ReactActivity` apps: warm deep links
(`onNewIntent`) and cold-launch links (`getInitialDeepLink`) are captured
automatically by the native module. Declare your intent filters in
`AndroidManifest.xml` as usual.

**iOS** — RN has no automatic app-delegate hook, so forward the URL callbacks into
the core from your `AppDelegate`:

```objc
#import "ReflectExample-Swift.h"   // or your app's <ProductModuleName>-Swift.h

// Cold launch — stash the URL so getInitialDeepLink() resolves before JS subscribes
- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  NSURL *url = launchOptions[UIApplicationLaunchOptionsURLKey];
  if (url) { [ReflectModule stashLaunchURL:url]; }
  // ... your existing RN setup ...
}

// Custom-scheme deep links
- (BOOL)application:(UIApplication *)app openURL:(NSURL *)url
    options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
  [ReflectModule handleURL:url];
  return [RCTLinkingManager application:app openURL:url options:options];
}

// Universal Links
- (BOOL)application:(UIApplication *)application
    continueUserActivity:(NSUserActivity *)userActivity
      restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> *))restorationHandler {
  if (userActivity.webpageURL) { [ReflectModule handleURL:userActivity.webpageURL]; }
  return [RCTLinkingManager application:application
                  continueUserActivity:userActivity
                    restorationHandler:restorationHandler];
}
```

Then subscribe in JS:

```ts
const unsub = Reflect.onDeepLink((dl) => console.log("deep link:", dl.url, dl.path));
const initial = await Reflect.getInitialDeepLink();   // link that cold-launched the app
```

## What's new in v2

Because the SDK now runs on the shared core, these methods are available in
addition to the v1 API: `trackAdRevenue`, `verifyPurchase`, `setThirdPartySharing`,
`setPartnerSharing`, `setExternalDeviceId`, `setPartnerParameter` /
`unsetPartnerParameter` / `clearPartnerParameters`, `setOfflineMode`, `isEnabled`,
`getLastDeepLink`, `getAttributionWithTimeout`, `resolveDeepLink`, `handleDeepLink`,
`requestIosTracking` (ATT), `setIntegrityToken`, `setPushToken`, `getDebugState`,
and an `onAttribution(listener)` stream. `trackPurchase` / `trackSubscription` now
hit the core's real purchase handler (receipt validation + dedup), and every event
is HMAC-signed with `sdk_version: react-native-2.x`.

**Upgrading from v1:** the `install_uuid` is preserved automatically (the core reads
the same storage key the v1 module used), so upgrades are not counted as reinstalls.

## How the native core is distributed

The SDK is a thin wrapper over the shared native engine, published from its own
public repos — you never copy the core into this SDK:

- **Android** → `com.github.bablu147:reflect-android` via **JitPack**
- **iOS** → the **`ReflectCore`** pod (source: `github.com/bablu147/reflect-ios`)

The build is **dual-mode**: inside the Reflect monorepo it compiles the core from
`../../reflect-android` source (instant, no publish step); as an installed package
it pulls the published version. Nothing to configure for that switch — it's
automatic (`coreSrcDir.exists()`).

### Consumer setup

```sh
npm install @reflect-sdk/react-native   # or: npm install github:bablu147/reflect-sdk-react-native
cd ios && pod install && cd ..
```

Android needs the JitPack repo once, in your app's `android/settings.gradle`:

```gradle
dependencyResolutionManagement {
    repositories {
        maven { url 'https://jitpack.io' }   // for com.github.bablu147:reflect-android
    }
}
```

iOS: if `ReflectCore` is on CocoaPods trunk, `pod install` just works. If not yet
published to trunk, add to your `ios/Podfile`:

```ruby
pod 'ReflectCore', :git => 'https://github.com/bablu147/reflect-ios.git', :tag => '1.0.0'
```

### Releasing a new core version (maintainers)

1. Push `reflect-android` + `reflect-ios` (mirrored from the monorepo) and **tag**
   both `1.0.0` (matching `version` in `reflect-android/build.gradle` and
   `ReflectCore.podspec`). JitPack builds the Android AAR on first request.
2. `pod trunk push ReflectCore.podspec` (once per version) for zero-config iOS.
3. Bump the core version + the `reflect-android`/`ReflectCore` version in each SDK's
   build files. **No copying** — every SDK (RN, Flutter, Unity) references the version.

## License

MIT
