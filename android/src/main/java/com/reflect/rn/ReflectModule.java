package com.reflect.rn;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;
import org.json.JSONException;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Reflect React Native bridge module.
 * Mirrors the Unity SDK's functionality for React Native apps.
 */
public class ReflectModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "ReflectModule";
    private static final String PREFS_NAME = "reflect_sdk";
    private static final String KEY_INSTALL_UUID = "install_uuid";

    private final ReactApplicationContext reactContext;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private String appKey;
    private String companyKey;
    private String baseUrl = "https://reflect.bablu147147.workers.dev";
    private boolean debug = false;
    private boolean initialized = false;
    private String installUuid;
    private String userId;
    private JSONObject userProperties;
    private boolean advertisingConsent = true;

    public ReflectModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    @NonNull
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void initialize(String configJson) {
        if (initialized) return;

        try {
            JSONObject config = new JSONObject(configJson);
            this.appKey = config.getString("appKey");
            this.companyKey = config.optString("companyKey", null);
            this.debug = config.optBoolean("debug", false);

            String url = config.optString("baseUrl", null);
            if (url != null && !url.isEmpty()) this.baseUrl = url;

            if (config.optBoolean("requireAdvertisingConsent", false)) {
                this.advertisingConsent = false;
            }
        } catch (JSONException e) {
            log("Initialize parse error: " + e.getMessage());
            return;
        }

        this.installUuid = getOrCreateInstallUuid();
        this.initialized = true;

        // Send app_open event
        trackEventInternal("app_open", null);

        log("Initialized — appKey=" + appKey + " installUuid=" + installUuid);
    }

    @ReactMethod
    public void trackEvent(String eventName, @Nullable String propertiesJson) {
        if (!initialized) return;
        trackEventInternal(eventName, propertiesJson);
    }

    @ReactMethod
    public void trackRevenue(double amount, String currency, @Nullable String transactionId,
                             @Nullable String productId, @Nullable String revenueType) {
        if (!initialized) return;

        try {
            JSONObject props = new JSONObject();
            props.put("revenue_amount", amount);
            props.put("revenue_currency", currency);
            if (transactionId != null) props.put("transaction_id", transactionId);
            if (productId != null) props.put("product_id", productId);
            if (revenueType != null) props.put("revenue_type", revenueType);
            trackEventInternal("revenue", props.toString());
        } catch (JSONException e) {
            log("trackRevenue error: " + e.getMessage());
        }
    }

    @ReactMethod
    public void setUserId(String userId) {
        this.userId = userId;
    }

    @ReactMethod
    public void clearUserId() {
        this.userId = null;
    }

    @ReactMethod
    public void setUserProperties(String propertiesJson) {
        try {
            this.userProperties = new JSONObject(propertiesJson);
        } catch (JSONException e) {
            log("setUserProperties parse error: " + e.getMessage());
        }
    }

    @ReactMethod
    public void setAdvertisingConsent(boolean granted) {
        this.advertisingConsent = granted;
    }

    @ReactMethod
    public void getInstallUuid(Promise promise) {
        promise.resolve(installUuid != null ? installUuid : "");
    }

    @ReactMethod
    public void getAttribution(Promise promise) {
        // Attribution data is fetched from the server
        // For now, return cached attribution if available
        SharedPreferences prefs = getPrefs();
        String attr = prefs.getString("attribution_json", null);
        promise.resolve(attr);
    }

    @ReactMethod
    public void updateConversionValue(double fineValue, @Nullable String coarseValue,
                                      boolean lockWindow, Promise promise) {
        // SKAN is iOS-only; Android no-op
        promise.resolve("{\"success\":true}");
    }

    @ReactMethod
    public void getInitialDeepLink(Promise promise) {
        // Check if app was opened with an intent containing a deep link
        if (getCurrentActivity() != null && getCurrentActivity().getIntent() != null) {
            android.net.Uri data = getCurrentActivity().getIntent().getData();
            if (data != null) {
                try {
                    JSONObject dl = new JSONObject();
                    dl.put("url", data.toString());
                    dl.put("path", data.getPath());
                    dl.put("isDeferred", false);

                    JSONObject params = new JSONObject();
                    for (String key : data.getQueryParameterNames()) {
                        params.put(key, data.getQueryParameter(key));
                    }
                    dl.put("params", params);
                    dl.put("clickId", data.getQueryParameter("click_id"));
                    dl.put("campaign", data.getQueryParameter("campaign"));
                    dl.put("partner", data.getQueryParameter("partner"));

                    promise.resolve(dl.toString());
                    return;
                } catch (JSONException e) {
                    log("Deep link parse error: " + e.getMessage());
                }
            }
        }
        promise.resolve(null);
    }

    @ReactMethod
    public void setEnabled(boolean enabled) {
        // Could persist this and gate all tracking
        log("setEnabled: " + enabled);
    }

    @ReactMethod
    public void deleteUserData(Promise promise) {
        if (!initialized) {
            promise.resolve("{\"success\":false,\"error\":\"not_initialized\"}");
            return;
        }
        executor.execute(() -> {
            try {
                // POST deletion request to server
                URL url = new URL(baseUrl + "/privacy/delete");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.setDoOutput(true);

                JSONObject body = new JSONObject();
                body.put("app_key", appKey);
                body.put("install_uuid", installUuid);
                if (userId != null) body.put("user_id", userId);

                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }

                int code = conn.getResponseCode();
                conn.disconnect();

                // Clear local state
                userId = null;
                userProperties = null;
                SharedPreferences prefs = getPrefs();
                prefs.edit().clear().apply();

                // Regenerate install UUID for future use
                installUuid = UUID.randomUUID().toString().replace("-", "");
                prefs.edit().putString(KEY_INSTALL_UUID, installUuid).apply();

                promise.resolve("{\"success\":" + (code >= 200 && code < 300) + "}");
            } catch (Exception e) {
                log("deleteUserData error: " + e.getMessage());
                promise.resolve("{\"success\":false,\"error\":\"" + e.getMessage() + "\"}");
            }
        });
    }

    @ReactMethod
    public void flush() {
        // Trigger immediate network send (no-op if queue empty)
        log("flush");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    private void trackEventInternal(String eventName, @Nullable String propertiesJson) {
        executor.execute(() -> {
            try {
                JSONObject payload = new JSONObject();
                payload.put("app_key", appKey);
                payload.put("event_name", eventName);
                payload.put("event_id", UUID.randomUUID().toString().replace("-", ""));
                payload.put("event_ts_ms", System.currentTimeMillis());
                payload.put("install_uuid", installUuid);
                payload.put("sdk_version", "rn-1.1.0");
                payload.put("platform", "android");

                if (userId != null) payload.put("user_id", userId);
                if (companyKey != null) payload.put("company_key", companyKey);

                // Device info
                JSONObject device = new JSONObject();
                device.put("os", "android");
                device.put("os_version", Build.VERSION.RELEASE);
                device.put("model", Build.MODEL);
                device.put("manufacturer", Build.MANUFACTURER);
                device.put("locale", java.util.Locale.getDefault().toString());
                payload.put("device", device);

                // Properties
                if (propertiesJson != null) {
                    payload.put("properties", new JSONObject(propertiesJson));
                }
                if (userProperties != null) {
                    payload.put("user_properties", userProperties);
                }

                // GAID (if consent granted)
                if (advertisingConsent) {
                    String gaid = getGaid();
                    if (gaid != null) device.put("gaid", gaid);
                }

                sendEvent(payload);
            } catch (Exception e) {
                log("trackEvent error: " + e.getMessage());
            }
        });
    }

    private void sendEvent(JSONObject payload) {
        try {
            URL url = new URL(baseUrl + "/event");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);

            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }

            int code = conn.getResponseCode();
            log("Event sent: " + payload.optString("event_name") + " → " + code);
            conn.disconnect();
        } catch (Exception e) {
            log("Network error: " + e.getMessage());
        }
    }

    private String getOrCreateInstallUuid() {
        SharedPreferences prefs = getPrefs();
        String uuid = prefs.getString(KEY_INSTALL_UUID, null);
        if (uuid == null) {
            uuid = UUID.randomUUID().toString().replace("-", "");
            prefs.edit().putString(KEY_INSTALL_UUID, uuid).apply();
        }
        return uuid;
    }

    @Nullable
    private String getGaid() {
        try {
            // Use reflection to avoid hard dependency on play-services-ads
            Class<?> cls = Class.forName("com.google.android.gms.ads.identifier.AdvertisingIdClient");
            Object info = cls.getMethod("getAdvertisingIdInfo", Context.class)
                    .invoke(null, reactContext.getApplicationContext());
            if (info != null) {
                boolean limited = (boolean) info.getClass().getMethod("isLimitAdTrackingEnabled").invoke(info);
                if (!limited) {
                    return (String) info.getClass().getMethod("getId").invoke(info);
                }
            }
        } catch (Exception e) {
            // Play services not available
        }
        return null;
    }

    private SharedPreferences getPrefs() {
        return reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private void log(String msg) {
        if (debug) {
            android.util.Log.d("Reflect", msg);
        }
    }

    private void sendDeepLinkEvent(String json) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("ReflectDeepLink", Arguments.createMap());
        }
    }
}
