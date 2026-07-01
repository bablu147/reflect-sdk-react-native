/**
 * Reflect React Native SDK — E2E test app.
 * Initializes the SDK (signed ingest via the shared core), fires a battery of
 * events, and surfaces install_uuid / attribution / debug state on screen.
 */
import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    StyleSheet,
} from "react-native";
import { Reflect } from "@reflect-sdk/react-native";
import type { DeepLinkData, AttributionData } from "@reflect-sdk/react-native";

// Filled in per E2E run (disposable sandbox app in prod).
const APP_KEY = "__APP_KEY__";
const COMPANY_KEY = "__COMPANY_KEY__";
const SIGNING_SECRET = "__SIGNING_SECRET__";

export default function App() {
    const [installUuid, setInstallUuid] = useState<string>("");
    const [attribution, setAttribution] = useState<AttributionData | null>(null);
    const [deepLink, setDeepLink] = useState<DeepLinkData | null>(null);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) =>
        setLog((prev) => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 60));

    useEffect(() => {
        Reflect.initialize({
            appKey: APP_KEY,
            companyKey: COMPANY_KEY,
            signingSecret: SIGNING_SECRET,
            debug: true,
        });
        addLog("initialized (signed)");

        const unsubDL = Reflect.onDeepLink((dl) => {
            setDeepLink(dl);
            addLog(`deepLink: ${dl.url}`);
        });
        const unsubAttr = Reflect.onAttribution((a) => {
            setAttribution(a);
            addLog(`attribution: ${a.partner ?? "?"}/${a.campaign ?? "?"}`);
        });

        Reflect.getInstallUuid().then((u) => {
            setInstallUuid(u);
            addLog(`install_uuid: ${u}`);
        });

        // Auto-fire the custom-event battery ~2.5s after init (headless E2E — no tap).
        const t = setTimeout(fireBattery, 2500);

        return () => {
            clearTimeout(t);
            unsubDL();
            unsubAttr();
        };
    }, []);

    const fireBattery = () => {
        Reflect.trackEvent("rn_e2e_event", { platform: "react-native", n: 1 });
        Reflect.trackEvent("level_completed", { level: 7, score: 42000 });
        Reflect.trackRevenue({ amount: 4.99, currency: "USD", productId: "coins_500" });
        Reflect.trackAdRevenue({ revenue: 0.012, currency: "USD", source: "applovin_max", impressions: 1 });
        Reflect.setUserId("rn_user_42");
        Reflect.setAudience("whales", "beta");
        Reflect.flush();
        addLog("fired event battery + flush");
    };

    return (
        <SafeAreaView style={styles.root}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Reflect RN — E2E</Text>
                <Text style={styles.mono}>install_uuid: {installUuid || "…"}</Text>
                <Text style={styles.mono}>attribution: {attribution ? JSON.stringify(attribution) : "—"}</Text>
                <Text style={styles.mono}>deepLink: {deepLink ? deepLink.url : "—"}</Text>

                <TouchableOpacity style={styles.btn} onPress={fireBattery}>
                    <Text style={styles.btnText}>Fire event battery</Text>
                </TouchableOpacity>

                <View style={styles.logBox}>
                    {log.map((l, i) => (
                        <Text key={i} style={styles.logLine}>{l}</Text>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0b0b12" },
    content: { padding: 20 },
    title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 16 },
    mono: { color: "#9fe", fontFamily: "Menlo", fontSize: 12, marginBottom: 6 },
    btn: { backgroundColor: "#4f46e5", padding: 14, borderRadius: 10, marginVertical: 16 },
    btnText: { color: "#fff", textAlign: "center", fontWeight: "600" },
    logBox: { borderTopWidth: 1, borderTopColor: "#333", paddingTop: 10 },
    logLine: { color: "#bbb", fontFamily: "Menlo", fontSize: 11, marginBottom: 3 },
});
