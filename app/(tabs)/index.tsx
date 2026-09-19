import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Alert, Modal, FlatList } from "react-native";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { refreshCatalog, runSaleSync } from "@/lib/sync";
import { enqueueSale, getCachedProfile, type CachedProduct, type SaleCartItem } from "@/lib/db";
import { calcLine, lineTotal, DEFAULT_VAT_RATE } from "@/lib/vat";
import { colors } from "@/constants/theme";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function NewSaleScreen() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [cart, setCart] = useState<SaleCartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [vatRate, setVatRate] = useState(DEFAULT_VAT_RATE);

  useEffect(() => {
    refreshCatalog().then(setProducts);
    getCachedProfile().then((p) => {
      if (p) setVatRate(p.shop.vatRate);
    });
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
          unitShortCode: product.unitShortCode,
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

  function quantityInCart(productId: string): number {
    return cart.find((line) => line.productId === productId)?.quantity ?? 0;
  }

  const total = cart.reduce((sum, line) => sum + lineTotal(line.quantity, line.unitPrice), 0);
  const reviewTotals = cart.reduce(
    (acc, line) => {
      const t = calcLine(line.quantity, line.unitPrice, vatRate);
      return { net: acc.net + t.totalValue, vat: acc.vat + t.vat, gross: acc.gross + t.valueAfterVat };
    },
    { net: 0, vat: 0, gross: 0 }
  );

  function openCart() {
    if (cart.length === 0) {
      Alert.alert("No items", "Tap an item above to add it first.");
      return;
    }
    setReviewOpen(true);
  }

  async function confirmSave() {
    if (!receiptNumber.trim()) {
      Alert.alert("Missing receipt number", "Enter the VAT receipt number you issued.");
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
      setReviewOpen(false);
      runSaleSync();
      Alert.alert("Saved", "Sale recorded. It will sync automatically.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Fixed header — stays put while the list scrolls */}
      <View className="border-b border-line bg-surface px-5 pb-4 pt-2">
        <Text className="mb-3 text-xl font-heading text-ink">Record a sale</Text>
        <View className="flex-row items-center gap-2.5 rounded-xl border border-line bg-background px-3.5 h-[50px]">
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
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListHeaderComponent={
          <Text className="px-5 pb-2 pt-4 text-[13px] font-manrope-semibold text-ink-soft">Tap an item to add it</Text>
        }
        ItemSeparatorComponent={() => <View className="h-[1px] bg-line ml-[68px]" />}
        renderItem={({ item }) => {
          const qty = quantityInCart(item.id);
          return (
            <Pressable
              onPress={() => addProduct(item)}
              className="flex-row items-center gap-3 px-5 py-3.5 active:bg-surface-alt"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-alt">
                <Text className="text-base font-heading-semibold text-ink-soft">{initialOf(item.name)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-manrope-semibold text-ink">{item.name}</Text>
                <Text className="mt-0.5 font-mono text-xs text-ink-soft">
                  {item.unitPriceBeforeVat.toFixed(2)} / {item.unitShortCode}
                </Text>
              </View>
              {qty > 0 && (
                <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-brand px-1.5">
                  <Text className="font-manrope-bold text-xs text-brand-ink">{qty}</Text>
                </View>
              )}
              <View className="h-8 w-8 items-center justify-center rounded-full bg-brand">
                <Ionicons name="add" size={18} color={colors.onPrimary} />
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text className="px-5 py-6 font-sans text-[13px] text-ink-faint">
            No products cached yet. Connect once to load the catalog.
          </Text>
        }
      />

      <View className="border-t border-line bg-surface px-5 py-3">
        {/* No extra insets.bottom here — the Tabs navigator already reserves
            safe-area space below its bar, so adding it again just doubles the gap. */}
        <Pressable
          onPress={openCart}
          disabled={cart.length === 0}
          className={`flex-row items-center gap-2.5 rounded-xl px-4 py-3.5 ${
            cart.length === 0 ? "bg-surface-alt" : "bg-brand"
          }`}
        >
          {cart.length > 0 && (
            <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-black/15 px-1.5">
              <Text className="font-manrope-bold text-xs text-brand-ink">{cart.length}</Text>
            </View>
          )}
          <Text
            className={`flex-1 font-manrope-bold text-[15px] ${cart.length === 0 ? "text-ink-faint" : "text-brand-ink"}`}
          >
            {cart.length === 0 ? "Tap an item to start a sale" : "View cart"}
          </Text>
          {cart.length > 0 && (
            <Text className="font-mono-semibold text-[15px] text-brand-ink">{total.toFixed(2)}</Text>
          )}
        </Pressable>
      </View>

      <Modal visible={reviewOpen} animationType="slide" transparent onRequestClose={() => setReviewOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="max-h-[85%] rounded-t-2xl bg-surface p-5"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <View className="mb-3 h-1 w-9 self-center rounded-full bg-line" />
            <Text className="text-lg font-heading text-ink">Items sold</Text>
            <Text className="mb-3 mt-0.5 font-sans text-[13px] text-ink-soft">
              {receiptNumber.trim() ? `Receipt #${receiptNumber.trim()}` : "No receipt number entered yet"}
            </Text>

            <FlatList
              data={cart}
              keyExtractor={(item) => item.productId ?? item.description}
              className="mb-3"
              ItemSeparatorComponent={() => <View className="h-[1px] bg-line" />}
              renderItem={({ item: line }) => (
                <View className="flex-row items-center gap-3 py-3">
                  <View className="flex-1">
                    <Text className="text-[15px] font-manrope-semibold text-ink">{line.description}</Text>
                    <Text className="mt-0.5 font-mono text-xs text-ink-soft">
                      {line.unitShortCode ?? "—"} · {lineTotal(line.quantity, line.unitPrice).toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2.5">
                    <Pressable
                      onPress={() => changeQuantity(line.productId!, -1)}
                      className="h-7 w-7 items-center justify-center rounded-md border border-line bg-background"
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text className="min-w-5 text-center font-mono-semibold text-sm text-ink">{line.quantity}</Text>
                    <Pressable
                      onPress={() => changeQuantity(line.productId!, 1)}
                      className="h-7 w-7 items-center justify-center rounded-md border border-line bg-background"
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text className="font-sans text-[13px] text-ink-faint">Cart is empty.</Text>}
            />

            <View className="gap-1 border-t border-line pt-2.5">
              <View className="flex-row justify-between">
                <Text className="font-sans text-[13px] text-ink-soft">Net</Text>
                <Text className="font-mono text-[13px] text-ink">{reviewTotals.net.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="font-sans text-[13px] text-ink-soft">VAT ({(vatRate * 100).toFixed(0)}%)</Text>
                <Text className="font-mono text-[13px] text-ink">{reviewTotals.vat.toFixed(2)}</Text>
              </View>
              <View className="mt-1 flex-row justify-between border-t border-line pt-2.5">
                <Text className="font-sans text-sm text-ink-soft">Total</Text>
                <Text className="font-mono-semibold text-lg text-ink">{reviewTotals.gross.toFixed(2)}</Text>
              </View>
            </View>

            <Pressable
              onPress={confirmSave}
              disabled={submitting}
              className={`mt-3 items-center rounded-xl bg-brand py-4 ${submitting ? "opacity-50" : ""}`}
            >
              <Text className="font-manrope-bold text-base text-brand-ink">
                {submitting ? "Saving..." : "Save sale"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
