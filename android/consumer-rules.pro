# Reflect React Native SDK — consumer ProGuard/R8 rules.
#
# These propagate automatically to any app that depends on the SDK (shipped via
# `consumerProguardFiles`). The shared native core (ReflectCore.kt) loads several
# optional Play-Services / OEM classes via reflection (Class.forName / getMethod),
# so R8 cannot see the references and would strip the classes in a consumer's
# release build — silently breaking GAID, OAID and the install referrer. Keep them.
# (The RN bridge module ReflectModule + @ReactMethod are kept by React Native's
# own consumer rules; the core's classes are reached by direct calls so R8 keeps
# them — VERIFIED: a minified R8 build still resolves GAID/App-Set-ID/referrer.)

# Google Advertising ID (GAID) — readGaid() reflects on AdvertisingIdClient.
# Without this, R8 removes it and gaid/lat_enabled come back null on every
# release build (the #1 Android deterministic match key).
-keep class com.google.android.gms.ads.identifier.AdvertisingIdClient { *; }
-keep class com.google.android.gms.ads.identifier.AdvertisingIdClient$Info { *; }

# Play Install Referrer library — referenced directly, but keep its AIDL/binder
# internals defensively so R8 can't strip the service proxy (Adjust keeps this
# same package in its consumer rules).
-keep public class com.android.installreferrer.** { *; }

# China-market OAID (MSA / MdidSdkHelper) — collectOaid() reflects on these
# (optional, app-supplied).
-keep class com.bun.miitmdid.** { *; }
-dontwarn com.bun.miitmdid.**
