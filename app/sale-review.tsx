import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { enqueueSale } from "@/lib/db";
import { runSaleSync } from "@/lib/sync";
import { calcLine, lineTotal } from "@/lib/vat";
import { colors } from "@/constants/theme";
import { useCart } from "@/context/cart-context";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SaleReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    cart,
    receiptNumber,
    buyerName,
    buyerTin,
    vatRate,
    setReceiptNumber,
    setBuyerName,
    setBuyerTin,
    changeQuantity,
    commitLineQuantity,
    updateLineDescription,
    updateLinePrice,
    resetSale,
  } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [showBuyer, setShowBuyer] = useState(false);
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);

  const totals = cart.reduce(
    (acc, line) => {
      const t = calcLine(line.quantity, line.unitPrice, vatRate);
      return { net: acc.net + t.totalValue, vat: acc.vat + t.vat, gross: acc.gross + t.valueAfterVat };
    },
    { net: 0, vat: 0, gross: 0 }
  );

  async function confirmSave() {
    if (!receiptNumber.trim()) {
      Alert.alert("Missing receipt number", "Enter the VAT receipt number you issued.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert("No items", "Add at least one item before saving.");
      return;
    }

    setSubmitting(true);
    try {
      await enqueueSale({
        clientId: Crypto.randomUUID(),
        vatReceiptNumber: receiptNumber.trim(),
        saleDate: todayIso(),
        buyerTin: buyerTin.trim() || null,
        buyerName: buyerName.trim() || null,
        items: cart,
      });
      resetSale();
      runSaleSync();
      router.back();
      Alert.alert("Saved", "Sale recorded. It will sync automatically.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 border-b border-line bg-surface px-5 pb-4 pt-5">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text className="text-xl font-heading text-ink">Review sale</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="mt-4 flex-row items-center gap-2.5 rounded-xl border border-line bg-background px-3.5 h-[50px]">
            <Ionicons name="receipt-outline" size={18} color={colors.textFaint} />
            <TextInput
              className="flex-1 font-sans text-base text-ink"
              placeholder="VAT receipt number"
              placeholderTextColor={colors.textFaint}
              value={receiptNumber}
              onChangeText={setReceiptNumber}
              autoCapitalize="none"
            />
          </View>

          <Text className="mb-1 mt-5 text-lg font-heading text-ink">Items sold</Text>
          <View className="mb-1">
            {cart.map((line, index) => (
              <View key={line.productId ?? line.description}>
                {index > 0 && <View className="h-[1px] bg-line" />}
                <View className="gap-2 py-3">
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      className="flex-1 font-manrope-semibold text-[15px] text-ink"
                      value={line.description}
                      onChangeText={(text) => updateLineDescription(line.productId!, text)}
                      placeholder="Name on receipt"
                      placeholderTextColor={colors.textFaint}
                    />
                    <View className="flex-row items-center gap-2.5">
                      <Pressable
                        onPress={() => changeQuantity(line.productId!, -1)}
                        className="h-7 w-7 items-center justify-center rounded-md border border-line bg-background"
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </Pressable>
                      {editingQtyId === line.productId ? (
                        <TextInput
                          key={`qty-edit-${line.productId}`}
                          autoFocus
                          selectTextOnFocus
                          keyboardType="decimal-pad"
                          defaultValue={String(line.quantity)}
                          className="min-w-10 rounded-md border border-line bg-background px-1 py-0.5 text-center font-mono-semibold text-sm text-ink"
                          onEndEditing={(e) => {
                            commitLineQuantity(line.productId!, e.nativeEvent.text);
                            setEditingQtyId(null);
                          }}
                          onSubmitEditing={(e) => {
                            commitLineQuantity(line.productId!, e.nativeEvent.text);
                            setEditingQtyId(null);
                          }}
                        />
                      ) : (
                        <Pressable onPress={() => setEditingQtyId(line.productId!)}>
                          <Text className="min-w-5 text-center font-mono-semibold text-sm text-ink">
                            {line.quantity}
                          </Text>
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => changeQuantity(line.productId!, 1)}
                        className="h-7 w-7 items-center justify-center rounded-md border border-line bg-background"
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="font-mono text-xs text-ink-soft">{line.unitShortCode ?? "—"} ·</Text>
                    <TextInput
                      key={line.productId}
                      className="w-20 rounded-md border border-line bg-background px-2 py-1 font-mono text-xs text-ink"
                      defaultValue={String(line.unitPrice)}
                      onEndEditing={(e) => updateLinePrice(line.productId!, e.nativeEvent.text)}
                      keyboardType="decimal-pad"
                    />
                    <Text className="font-mono text-xs text-ink-soft">
                      each · {lineTotal(line.quantity, line.unitPrice).toFixed(2)} total
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {cart.length === 0 && (
              <Text className="py-6 font-sans text-[13px] text-ink-faint">Cart is empty.</Text>
            )}
          </View>

          <Pressable onPress={() => setShowBuyer((v) => !v)} className="py-2">
            <Text className="font-manrope-semibold text-[13px] text-ink-soft underline">
              {showBuyer ? "Hide buyer details" : "Add buyer details (optional)"}
            </Text>
          </Pressable>
          {showBuyer && (
            <View className="gap-2 pb-2">
              <TextInput
                className="rounded-lg border border-line bg-background px-3 py-2.5 font-sans text-sm text-ink"
                placeholder="Buyer name"
                placeholderTextColor={colors.textFaint}
                value={buyerName}
                onChangeText={setBuyerName}
              />
              <TextInput
                className="rounded-lg border border-line bg-background px-3 py-2.5 font-sans text-sm text-ink"
                placeholder="Buyer TIN"
                placeholderTextColor={colors.textFaint}
                value={buyerTin}
                onChangeText={setBuyerTin}
                autoCapitalize="none"
                keyboardType="number-pad"
              />
            </View>
          )}

          <View className="gap-1 border-t border-line pb-5 pt-2.5">
            <View className="flex-row justify-between">
              <Text className="font-sans text-[13px] text-ink-soft">Net</Text>
              <Text className="font-mono text-[13px] text-ink">{totals.net.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="font-sans text-[13px] text-ink-soft">VAT ({(vatRate * 100).toFixed(0)}%)</Text>
              <Text className="font-mono text-[13px] text-ink">{totals.vat.toFixed(2)}</Text>
            </View>
            <View className="mt-1 flex-row justify-between border-t border-line pt-2.5">
              <Text className="font-sans text-sm text-ink-soft">Total</Text>
              <Text className="font-mono-semibold text-lg text-ink">{totals.gross.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        <View className="border-t border-line bg-surface px-5 py-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={confirmSave}
            disabled={submitting}
            className={`items-center rounded-xl bg-brand py-4 ${submitting ? "opacity-50" : ""}`}
          >
            <Text className="font-manrope-bold text-base text-brand-ink">
              {submitting ? "Saving..." : "Save sale"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
