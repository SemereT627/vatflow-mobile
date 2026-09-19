import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { refreshCatalog, runSaleSync } from "@/lib/sync";
import { enqueueSale, type CachedProduct, type SaleCartItem } from "@/lib/db";
import { UNIT_OF_MEASURE_LABELS, lineTotal } from "@/lib/vat";
import { colors, radius, spacing } from "@/constants/theme";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewSaleScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [cart, setCart] = useState<SaleCartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshCatalog().then(setProducts);
  }, []);

  const addProduct = useCallback((product: CachedProduct) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          description: product.name,
          unitOfMeasure: product.unitOfMeasure,
          quantity: 1,
          unitPrice: product.unitPriceBeforeVat,
        },
      ];
    });
  }, []);

  function changeQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) =>
          line.productId === productId ? { ...line, quantity: line.quantity + delta } : line
        )
        .filter((line) => line.quantity > 0)
    );
  }

  const total = cart.reduce((sum, line) => sum + lineTotal(line.quantity, line.unitPrice), 0);

  async function handleSubmit() {
    if (!receiptNumber.trim()) {
      Alert.alert("Missing receipt number", "Enter the VAT receipt number you issued.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("No items", "Add at least one item sold.");
      return;
    }

    setSubmitting(true);
    try {
      await enqueueSale({
        clientId: Crypto.randomUUID(),
        vatReceiptNumber: receiptNumber.trim(),
        saleDate: todayIso(),
        buyerTin: null,
        buyerName: null,
        items: cart,
      });
      setReceiptNumber("");
      setCart([]);
      runSaleSync();
      Alert.alert("Saved", "Sale recorded. It will sync automatically.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Record a sale</Text>

        <TextInput
          style={styles.receiptInput}
          placeholder="VAT receipt number"
          placeholderTextColor={colors.textFaint}
          value={receiptNumber}
          onChangeText={setReceiptNumber}
          autoCapitalize="none"
        />

        <Text style={styles.sectionLabel}>Tap an item to add it</Text>
        <View style={styles.productGrid}>
          {products.map((product) => (
            <Pressable key={product.id} style={styles.productChip} onPress={() => addProduct(product)}>
              <Text style={styles.productChipName}>{product.name}</Text>
              <Text style={styles.productChipPrice}>{product.unitPriceBeforeVat.toFixed(2)}</Text>
            </Pressable>
          ))}
          {products.length === 0 && (
            <Text style={styles.emptyText}>No products cached yet. Connect once to load the catalog.</Text>
          )}
        </View>

        {cart.length > 0 && (
          <View style={styles.cart}>
            <Text style={styles.sectionLabel}>Items sold</Text>
            {cart.map((line) => (
              <View key={line.productId} style={styles.cartRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartRowName}>{line.description}</Text>
                  <Text style={styles.cartRowMeta}>
                    {UNIT_OF_MEASURE_LABELS[line.unitOfMeasure]} · {lineTotal(line.quantity, line.unitPrice).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable onPress={() => changeQuantity(line.productId!, -1)} style={styles.stepperButton}>
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <Text style={styles.stepperValue}>{line.quantity}</Text>
                  <Pressable onPress={() => changeQuantity(line.productId!, 1)} style={styles.stepperButton}>
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total.toFixed(2)}</Text>
        </View>
        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>{submitting ? "Saving..." : "Save sale"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heading: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: spacing.md },
  receiptInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: spacing.sm },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  productChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: "45%",
  },
  productChipName: { fontSize: 14, fontWeight: "600", color: colors.text },
  productChipPrice: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  emptyText: { fontSize: 13, color: colors.textFaint },
  cart: { marginTop: spacing.xl },
  cartRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  cartRowName: { fontSize: 14, fontWeight: "600", color: colors.text },
  cartRowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: { fontSize: 14, fontWeight: "700", color: colors.text, minWidth: 20, textAlign: "center" },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  totalLabel: { fontSize: 14, color: colors.textMuted },
  totalValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
