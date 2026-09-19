import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAllSales, discardSale, getSyncIssue, type PendingSale, type SyncIssue } from "@/lib/db";
import { runSaleSync } from "@/lib/sync";
import { lineTotal } from "@/lib/vat";
import { colors, fonts, radius, spacing } from "@/constants/theme";

const STATUS_META: Record<PendingSale["status"], { label: string; color: string; bg: string }> = {
  pending: { label: "Waiting to sync", color: colors.warning, bg: colors.warningSoft },
  syncing: { label: "Syncing...", color: colors.warning, bg: colors.warningSoft },
  synced: { label: "Synced", color: colors.success, bg: colors.successSoft },
  rejected: { label: "Rejected", color: colors.danger, bg: colors.dangerSoft },
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [sales, setSales] = useState<PendingSale[]>([]);
  const [issue, setIssue] = useState<SyncIssue | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setSales(await getAllSales());
    setIssue(await getSyncIssue());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await runSaleSync();
    await load();
    setRefreshing(false);
  }

  function handleDiscard(clientId: string) {
    Alert.alert("Discard sale?", "This removes the rejected entry from your queue.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          await discardSale(clientId);
          load();
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.heading}>Sales queue</Text>

      {issue && (
        <View style={styles.issueBanner}>
          <Ionicons name="warning-outline" size={16} color={colors.danger} />
          <Text style={styles.issueText}>{issue.message}</Text>
        </View>
      )}

      <FlatList
        data={sales}
        keyExtractor={(item) => item.clientId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No sales recorded yet.</Text>}
        renderItem={({ item }) => {
          const total = item.items.reduce((sum, line) => sum + lineTotal(line.quantity, line.unitPrice), 0);
          const meta = STATUS_META[item.status];
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Receipt #{item.vatReceiptNumber}</Text>
                <Text style={styles.rowMeta}>{item.saleDate} · {total.toFixed(2)}</Text>
                {item.status === "rejected" && item.failReason && (
                  <Text style={styles.rowReason}>{item.failReason}</Text>
                )}
              </View>
              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>
              {item.status === "rejected" && (
                <Pressable onPress={() => handleDiscard(item.clientId)} style={styles.discardButton}>
                  <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading: { fontSize: 20, fontFamily: fonts.heading, color: colors.text, padding: spacing.lg, paddingBottom: spacing.sm },
  issueBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerSoft,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: spacing.sm,
  },
  issueText: { color: colors.danger, fontSize: 12, flex: 1, fontFamily: fonts.body },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  emptyText: { fontSize: 13, color: colors.textFaint, marginTop: spacing.lg, fontFamily: fonts.body },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  rowTitle: { fontSize: 14, color: colors.text, fontFamily: fonts.bodySemibold },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontFamily: fonts.mono },
  rowReason: { fontSize: 11, color: colors.danger, marginTop: 2, fontFamily: fonts.body },
  badge: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: fonts.bodyBold },
  discardButton: { padding: 6 },
});
