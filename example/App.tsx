/**
 * Reflect React Native SDK — Example App
 *
 * Demonstrates: initialization, event tracking, revenue, deep links,
 * SKAN conversion value updates, and attribution retrieval.
 */

import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    StyleSheet,
    Alert,
} from "react-native";
import { Reflect } from "@reflect-sdk/react-native";
import type { DeepLinkData, AttributionData } from "@reflect-sdk/react-native";

const APP_KEY = "YOUR_APP_KEY"; // Replace with your Reflect app key

export default function App() {
    const [installUuid, setInstallUuid] = useState<string>("");
    const [attribution, setAttribution] = useState<AttributionData | null>(null);
    const [deepLink, setDeepLink] = useState<DeepLinkData | null>(null);
    const [log, setLog] = useState<string[]>([]);

    const addLog = (msg: string) => {
        setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    useEffect(() => {
        // 1. Initialize SDK
        Reflect.initialize({
            appKey: APP_KEY,
            debug: true,
        });
        addLog("SDK initialized");

        // 2. Get install UUID
        Reflect.getInstallUuid().then((uuid) => {
            setInstallUuid(uuid);
            addLog(`Install UUID: ${uuid}`);
        });

        // 3. Listen for deep links
        const unsubscribe = Reflect.onDeepLink((data) => {
            setDeepLink(data);
            addLog(`Deep link: ${data.url}`);
        });

        // 4. Check initial deep link
        Reflect.getInitialDeepLink().then((data) => {
            if (data) {
                setDeepLink(data);
                addLog(`Initial deep link: ${data.url}`);
            }
        });

        // 5. Get attribution
        Reflect.getAttribution().then((attr) => {
            setAttribution(attr);
            if (attr) addLog(`Attribution: ${attr.type} via ${attr.partner}`);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const trackLevelComplete = () => {
        Reflect.trackEvent("level_complete", { level: 5, score: 12500, time_s: 42 });
        addLog("Tracked: level_complete");
    };

    const trackPurchase = () => {
        Reflect.trackRevenue({
            amount: 4.99,
            currency: "USD",
            productId: "com.example.gems_pack_1",
            transactionId: `txn_${Date.now()}`,
            revenueType: "purchase",
        });
        addLog("Tracked: revenue $4.99 USD");
    };

    const updateSkan = async () => {
        const result = await Reflect.updateConversionValue(15, "medium", false);
        addLog(`SKAN update: ${result.success ? "OK" : result.error}`);
    };

    const setUser = () => {
        Reflect.setUserId("user_12345");
        Reflect.setUserProperties({ tier: "premium", level: 42 });
        addLog("Set user: user_12345 (premium, level 42)");
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.title}>Reflect SDK Demo</Text>
                <Text style={styles.subtitle}>React Native</Text>

                {/* Status */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Status</Text>
                    <Text style={styles.mono}>UUID: {installUuid || "loading..."}</Text>
                    <Text style={styles.mono}>
                        Attribution: {attribution ? `${attribution.type} / ${attribution.partner}` : "none"}
                    </Text>
                    <Text style={styles.mono}>
                        Deep link: {deepLink ? deepLink.url : "none"}
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Track Events</Text>
                    <TouchableOpacity style={styles.btn} onPress={trackLevelComplete}>
                        <Text style={styles.btnText}>Track: level_complete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={trackPurchase}>
                        <Text style={styles.btnText}>Track: revenue $4.99</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={updateSkan}>
                        <Text style={styles.btnText}>Update SKAN CV: 15</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={setUser}>
                        <Text style={styles.btnText}>Set User ID</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: "#333" }]} onPress={() => Reflect.flush()}>
                        <Text style={styles.btnText}>Flush</Text>
                    </TouchableOpacity>
                </View>

                {/* Log */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Log</Text>
                    {log.map((entry, i) => (
                        <Text key={i} style={styles.logEntry}>{entry}</Text>
                    ))}
                    {log.length === 0 && <Text style={styles.logEntry}>No events yet</Text>}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0b0e13" },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 4 },
    subtitle: { fontSize: 14, color: "#888", marginBottom: 20 },
    card: { backgroundColor: "#161b22", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#30363d" },
    cardTitle: { fontSize: 14, fontWeight: "600", color: "#fff", marginBottom: 10 },
    mono: { fontSize: 12, color: "#aaa", fontFamily: "monospace", marginBottom: 4 },
    btn: { backgroundColor: "#238636", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 8 },
    btnText: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
    logEntry: { fontSize: 11, color: "#666", fontFamily: "monospace", marginBottom: 2 },
});
