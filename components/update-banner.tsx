import { useEffect, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { colors } from "@/constants/theme";

/**
 * In-app OTA updates (EAS Update). expo-updates already checks on cold
 * launch; this also checks whenever the app returns to the foreground,
 * downloads quietly, then offers a restart instead of waiting for the next
 * cold launch. "Later" keeps a seller mid-sale from being interrupted — the
 * downloaded update still applies on the next launch.
 */
export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Updates are disabled in dev builds / Expo Go; nothing to do there.
  const enabled = Updates.isEnabled && !__DEV__;

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") Updates.checkForUpdateAsync().catch(() => {});
    });
    return () => sub.remove();
  }, [enabled]);

  // Download as soon as the server reports a newer compatible update.
  useEffect(() => {
    if (enabled && isUpdateAvailable && !isUpdatePending) {
      Updates.fetchUpdateAsync().catch(() => {});
    }
  }, [enabled, isUpdateAvailable, isUpdatePending]);

  // A newly downloaded update deserves a fresh prompt.
  useEffect(() => {
    if (isUpdatePending) setDismissed(false);
  }, [isUpdatePending]);

  if (!enabled || !isUpdatePending || dismissed) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-3 right-3 z-50"
      style={{ top: insets.top + 8 }}
    >
      <View
        accessibilityRole="alert"
        className="flex-row items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3"
        style={{ shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}
      >
        <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-manrope-semibold text-[15px] text-ink">Update ready</Text>
          <Text className="mt-0.5 font-sans text-[13px] text-ink-soft">
            Restart VatFlow to use the latest version.
          </Text>
        </View>
        <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityRole="button" className="px-1 py-2">
          <Text className="font-manrope-medium text-sm text-ink-soft">Later</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setRestarting(true);
            Updates.reloadAsync().catch(() => setRestarting(false));
          }}
          disabled={restarting}
          accessibilityRole="button"
          className="rounded-full bg-brand px-3 py-2"
          style={{ opacity: restarting ? 0.6 : 1 }}
        >
          <Text className="font-manrope-semibold text-sm text-brand-ink">
            {restarting ? "Restarting…" : "Restart"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
