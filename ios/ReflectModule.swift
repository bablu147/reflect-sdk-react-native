import Foundation
import React
import ReflectCore   // the shared, wrapper-agnostic engine (standalone pod)

// ─────────────────────────────────────────────────────────────────────────────
//  Thin React Native bridge over the shared, platform-agnostic ReflectCore engine.
//
//  ALL SDK logic — sessions, durable queue, HMAC signing, batching, response-driven
//  retry, dedup, device collection, deferred deep links, attribution, SKAN, ATT —
//  lives in ReflectCore, the SAME engine the Flutter + Unity wrappers bind to. This
//  module ONLY translates between the RN bridge (a single generic `handle` +
//  Promise + RCTEventEmitter) and the core's command-dispatch (`handle`) + listener
//  surface. The old standalone (unsigned NSURLSession / own IDFA / SKAN /
//  install_uuid) implementation is deleted.
// ─────────────────────────────────────────────────────────────────────────────

@objc(ReflectModule)
public class ReflectModule: RCTEventEmitter, ReflectListener {

    private static let deepLinkEvent = "ReflectDeepLink"
    private static let attributionEvent = "ReflectAttribution"

    // Shared reference so the host AppDelegate hooks (handleURL) can reach the core.
    private static weak var shared: ReflectModule?

    private let core = ReflectCore()
    private var hasListeners = false
    // Buffer one of each until JS subscribes — RCTEventEmitter DROPS (and warns on)
    // events emitted before startObserving. The core also buffers the deferred deep
    // link / first attribution until setListener; this covers the RN-subscribe window.
    private var pendingDeepLink: String?
    private var pendingAttribution: String?

    public override init() {
        super.init()
        // The core holds the listener WEAK; the bridge retains this RCTEventEmitter
        // module so `self` outlives the core's reference. Keep setListener in init.
        core.setListener(self)
        ReflectModule.shared = self
    }

    @objc public override static func requiresMainQueueSetup() -> Bool { return false }

    @objc public override func supportedEvents() -> [String] {
        return [ReflectModule.deepLinkEvent, ReflectModule.attributionEvent]
    }

    public override func startObserving() {
        hasListeners = true
        if let d = pendingDeepLink {
            sendEvent(withName: ReflectModule.deepLinkEvent, body: ["data": d]); pendingDeepLink = nil
        }
        if let a = pendingAttribution {
            sendEvent(withName: ReflectModule.attributionEvent, body: ["data": a]); pendingAttribution = nil
        }
    }

    public override func stopObserving() { hasListeners = false }

    // ─────────────────────────────────────────────────────────────────────────
    //  The single generic dispatcher (exposed to JS as NativeModules.ReflectModule
    //  .handle). Fire-and-forget commands resolve nil; async ones (verifyPurchase,
    //  resolveDeepLink, getAttributionWithTimeout, deleteUserData, requestIosTracking,
    //  updateConversionValue) resolve on the core's main-thread reply.
    // ─────────────────────────────────────────────────────────────────────────
    @objc(handle:args:resolve:reject:)
    func handle(_ method: String, args: NSDictionary?,
                resolve: @escaping RCTPromiseResolveBlock,
                reject: @escaping RCTPromiseRejectBlock) {
        core.handle(method: method, args: args as? [String: Any]) { value in
            if value is ReflectNotImplemented {
                reject("unimplemented", method, nil)
            } else if let e = value as? ReflectError {
                reject(e.code, e.message, nil)
            } else {
                resolve(ReflectModule.toResolvable(value))
            }
        }
    }

    // RN promises carry JSON-ish values. The core's sync getters return String /
    // Bool / nil directly; the few that return a dictionary (getDebugState,
    // verifyPurchase) are JSON-stringified so JS can JSON.parse them — the same
    // string-in/parse-out convention the JS uses for getAttribution/getInitialDeepLink.
    private static func toResolvable(_ value: Any?) -> Any? {
        guard let value = value else { return nil }
        if let dict = value as? [String: Any],
           let data = try? JSONSerialization.data(withJSONObject: dict),
           let s = String(data: data, encoding: .utf8) {
            return s
        }
        return value
    }

    // ── ReflectListener → RN device events (core dispatches these on the main thread)
    public func onDeepLink(_ data: Any) {
        let json = ReflectModule.jsonString(data)
        if hasListeners { sendEvent(withName: ReflectModule.deepLinkEvent, body: ["data": json]) }
        else { pendingDeepLink = json }
    }

    public func onAttribution(_ data: Any) {
        let json = ReflectModule.jsonString(data)
        if hasListeners { sendEvent(withName: ReflectModule.attributionEvent, body: ["data": json]) }
        else { pendingAttribution = json }
    }

    private static func jsonString(_ data: Any) -> String {
        if let dict = data as? [String: Any],
           let d = try? JSONSerialization.data(withJSONObject: dict),
           let s = String(data: d, encoding: .utf8) {
            return s
        }
        return String(describing: data)
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Host AppDelegate deep-link hooks. RN has no addApplicationDelegate auto-hook,
    //  so the host forwards openURL / continueUserActivity into the shared core via
    //  ReflectModule.handleURL, and stashes the cold-launch URL (so getInitialDeepLink
    //  resolves before JS subscribes). See README for the AppDelegate snippet.
    // ─────────────────────────────────────────────────────────────────────────
    @objc public static func handleURL(_ url: URL) {
        shared?.core.handleIncomingURL(url)
    }

    @objc public static func stashLaunchURL(_ url: URL) {
        UserDefaults.standard.set(url.absoluteString, forKey: "reflect_launch_url")
    }
}
