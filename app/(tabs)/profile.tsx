import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useAuth } from "@/context/auth-context";
import { getCachedProfile, getSyncIssue, type CachedProfile, type SyncIssue } from "@/lib/db";
import { refreshProfile, runSaleSync } from "@/lib/sync";
import { colors, fonts, radius, spacing } from "@/constants/theme";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [issue, setIssue] = useState<SyncIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const cached = await getCachedProfile();
    if (cached) setProfile(cached);
    setIssue(await getSyncIssue());
    const fresh = await refreshProfile();
    if (fresh) setProfile(fresh);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSyncNow() {
    setSyncing(true);
    const result = await runSaleSync();
    setIssue(await getSyncIssue());
    setSyncing(false);
    Alert.alert(
      "Sync complete",
      result.synced === 0 && result.rejected === 0
        ? "Nothing to sync — you're up to date."
        : `Synced ${result.synced}${result.rejected > 0 ? `, ${result.rejected} rejected` : ""}.`
    );
  }

  function handleSignOut() {
    Alert.alert("Sign out?", "You'll need to sign in again to record or sync sales.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);
  }

  const email = profile?.email ?? session?.user.email ?? "";
  const fullName = profile?.fullName ?? email;
  const showEmail = !!email && email !== fullName;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            {loading && !profile ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.avatarText}>{initialsOf(fullName || "?")}</Text>
            )}
          </View>
          <Text style={styles.name}>{fullName}</Text>
          {showEmail && <Text style={styles.email}>{email}</Text>}
          {profile && (
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{profile.role === "admin" ? "Admin" : "Seller"}</Text>
            </View>
          )}
        </View>

        {profile && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Shop</Text>
            <Text style={styles.cardTitle}>{profile.shop.businessName}</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardRowLabel}>TIN</Text>
              <Text style={styles.cardRowValue}>{profile.shop.tin ?? "—"}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardRowLabel}>VAT rate</Text>
              <Text style={styles.cardRowValue}>{(profile.shop.vatRate * 100).toFixed(0)}%</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Sync</Text>
          {issue ? (
            <View style={styles.issueBanner}>
              <Ionicons name="warning-outline" size={16} color={colors.danger} />
              <Text style={styles.issueText}>{issue.message}</Text>
            </View>
          ) : (
            <View style={styles.okBanner}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.okText}>Nothing pending.</Text>
            </View>
          )}
          <Pressable
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleSyncNow}
            disabled={syncing}
          >
            <Ionicons name="sync-outline" size={16} color={colors.text} />
            <Text style={styles.syncButtonText}>{syncing ? "Syncing…" : "Sync now"}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* No extra insets.bottom — the Tabs navigator already reserves safe-area space below its bar. */}
      <View style={styles.footer}>
        <Pressable style={styles.button} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
        <Text style={styles.version}>VatFlow v{Constants.expoConfig?.version ?? "1.0.0"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  header: { alignItems: "center", marginBottom: spacing.sm },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { color: colors.onPrimary, fontSize: 22, fontFamily: fonts.headingSemibold },
  name: { fontSize: 18, color: colors.text, fontFamily: fonts.heading },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontFamily: fonts.body },
  rolePill: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillText: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "uppercase",
    fontFamily: fonts.bodyBold,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardLabel: {
    fontSize: 11,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
    fontFamily: fonts.bodyBold,
  },
  cardTitle: { fontSize: 15, color: colors.text, marginBottom: spacing.sm, fontFamily: fonts.bodyBold },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardRowLabel: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.body },
  cardRowValue: { fontSize: 13, color: colors.text, fontFamily: fonts.mono },
  issueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.sm,
  },
  issueText: { color: colors.danger, fontSize: 12, flex: 1, fontFamily: fonts.body },
  okBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    padding: 10,
    marginBottom: spacing.sm,
  },
  okText: { color: colors.success, fontSize: 12, flex: 1, fontFamily: fonts.body },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  syncButtonDisabled: { opacity: 0.5 },
  syncButtonText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyBold },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.danger, fontSize: 15, fontFamily: fonts.bodyBold },
  version: { textAlign: "center", fontSize: 12, color: colors.textFaint, marginTop: spacing.sm, fontFamily: fonts.body },
});
