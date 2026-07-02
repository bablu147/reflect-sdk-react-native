package com.reflect.rn

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.reflect.core.ReflectCore
import com.reflect.core.ReflectListener
import com.reflect.core.ReflectResult
import org.json.JSONObject

// ─────────────────────────────────────────────────────────────────────────────
//  Thin React Native bridge over the shared com.reflect.core.ReflectCore engine.
//
//  ALL SDK logic — sessions, durable queue, HMAC signing, batching, response-driven
//  retry, dedup, device collection, deferred deep links, attribution — lives in
//  ReflectCore, the SAME engine the Flutter and Unity wrappers bind to. This module
//  ONLY translates between the RN bridge (a single generic `handle` + Promise +
//  DeviceEventEmitter) and the core's command-dispatch (`handle`) + listener
//  surface. It carries NO transport/attribution logic of its own — the old
//  standalone (unsigned HTTP, own install_uuid/GAID) implementation is deleted.
//
//  Written in Kotlin (not Java) so it compiles in the SAME kotlinc pass as the
//  source-included core — a Java module can't see the same-module Kotlin core.
// ─────────────────────────────────────────────────────────────────────────────
class ReflectModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ReflectListener, ActivityEventListener, LifecycleEventListener {

    // APPLICATION context (never an Activity) — mirrors the Flutter plugin.
    private val core = ReflectCore(reactContext.applicationContext)

    // Buffer one of each until the JS side (NativeEventEmitter) is live — RN drops
    // events emitted with no active React instance. The core already buffers the
    // deferred deep link / first attribution until setListener; this second buffer
    // covers the separate window before the JS instance connects.
    private var pendingDeepLink: String? = null
    private var pendingAttribution: String? = null

    init {
        core.setListener(this)
        core.start()                                  // durable-queue reload
        reactContext.addActivityEventListener(this)
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = "ReflectModule"

    // ── The single generic dispatcher — every host API call funnels through here
    //    and hits the core's 41-case handle(). Fire-and-forget commands resolve
    //    null; async ones resolve on the core's main-thread reply.
    @ReactMethod
    fun handle(method: String, args: ReadableMap?, promise: Promise) {
        val m: Map<String, Any?>? = args?.toHashMap()
        core.handle(method, m, object : ReflectResult {
            override fun success(value: Any?) { promise.resolve(toResolvable(value)) }
            override fun error(code: String, message: String?, details: Any?) { promise.reject(code, message) }
            override fun notImplemented() { promise.reject("unimplemented", method) }
        })
    }

    // RN's Promise.resolve carries null/Boolean/Number/String/Writable*. The core's
    // sync getters return String/Boolean/null directly; the few that return a Map
    // (getDebugState, verifyPurchase) are JSON-stringified so JS can JSON.parse them.
    private fun toResolvable(value: Any?): Any? =
        if (value is Map<*, *>) JSONObject(value).toString() else value

    // RCTEventEmitter contract stubs (so NativeEventEmitter doesn't warn on the
    // legacy bridge). DeviceEventEmitter needs no real subscribe bookkeeping.
    @ReactMethod fun addListener(eventName: String) { /* no-op */ }
    @ReactMethod fun removeListeners(count: Int) { /* no-op */ }

    // ── Core listener → RN device events (core dispatches these on the main thread).
    override fun onDeepLink(data: Any) {
        val json = jsonString(data)
        if (!emitJson(EVENT_DEEP_LINK, json)) pendingDeepLink = json
    }

    override fun onAttribution(data: Any) {
        val json = jsonString(data)
        if (!emitJson(EVENT_ATTRIBUTION, json)) pendingAttribution = json
    }

    /** @return true if delivered, false if there was no active JS instance. */
    private fun emitJson(name: String, json: String): Boolean {
        if (!reactContext.hasActiveReactInstance()) return false
        val map = Arguments.createMap().apply { putString("data", json) }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, map)
        return true
    }

    private fun flushPending() {
        pendingDeepLink?.let { if (emitJson(EVENT_DEEP_LINK, it)) pendingDeepLink = null }
        pendingAttribution?.let { if (emitJson(EVENT_ATTRIBUTION, it)) pendingAttribution = null }
    }

    private fun jsonString(data: Any): String =
        if (data is Map<*, *>) JSONObject(data).toString() else data.toString()

    // ── Activity + deep-link host wiring. Standard ReactActivity apps forward
    //    onNewIntent → RN → ActivityEventListener automatically, so WARM deep links
    //    are captured with no host code. Cold links are read by the core off the
    //    activity intent via getInitialDeepLink once the activity is attached.
    // NOTE: params are NON-NULL to match RN's ActivityEventListener. Recent RN
    // (Kotlin-migrated ReactAndroid) declares these as non-null `Intent`/`Activity`,
    // so a nullable `Intent?`/`Activity?` override "overrides nothing" and the module
    // fails to compile. Older RN exposes them as Java platform types, which accept a
    // non-null override too — so this signature is correct on every supported RN.
    override fun onNewIntent(intent: Intent) {
        reactContext.currentActivity?.intent = intent               // so a later getInitialDeepLink sees it
        intent.data?.let { core.handleDeepLinkUri(it) }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) { /* unused */ }

    override fun onHostResume() {
        reactContext.currentActivity?.let { core.attachActivity(it) } // enables getInitialDeepLink
        flushPending()
    }

    override fun onHostPause() { /* no-op */ }

    override fun onHostDestroy() { core.detachActivity() }

    companion object {
        private const val EVENT_DEEP_LINK = "ReflectDeepLink"
        private const val EVENT_ATTRIBUTION = "ReflectAttribution"
    }
}
