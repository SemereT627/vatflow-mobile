import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/auth-context";
import { colors, radius, spacing } from "@/constants/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.heading}>Profile</Text>
      <Text style={styles.email}>{session?.user.email}</Text>

      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  heading: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  email: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.xl },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
});
