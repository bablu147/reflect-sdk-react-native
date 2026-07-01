// ─────────────────────────────────────────────────────────────────────────────
//  Native bridge to the shared ReflectCore engine.
//
//  The native module (Android ReflectModule.java, iOS ReflectModule.swift) exposes
//  ONE generic dispatcher — handle(method, args) — that maps 1:1 onto the core's
//  ReflectCore.handle(method, args, result). Fire-and-forget commands resolve
//  null; getters + async commands resolve a value (String / Boolean / JSON string,
//  JSON.parsed by the caller where needed). This replaces the old per-method
//  standalone spec — all SDK logic now lives in the shared core.
//
//  Legacy bridge (NativeModules proxy) — NOT a TurboModule. It runs under the New
//  Architecture via the interop layer; a future codegen/TurboModule migration is
//  separable and does not change this binding.
// ─────────────────────────────────────────────────────────────────────────────

import { NativeModules, Platform } from "react-native";

export interface NativeReflectSpec {
    /** Generic command dispatcher → ReflectCore.handle(method, args, result). */
    handle(method: string, args: Record<string, unknown> | null): Promise<unknown>;
}

const LINKING_ERROR =
    `The package 'reflect-react-native' doesn't seem to be linked. Make sure:\n\n` +
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
