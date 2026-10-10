import { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { refreshCatalog } from "@/lib/sync";
import { type CachedProduct } from "@/lib/db";
import { colors } from "@/constants/theme";
import { useCart } from "@/context/cart-context";

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default function NewSaleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const { cart, addProduct, changeQuantity, quantityInCart } = useCart();

  useEffect(() => {
    refreshCatalog().then(setProducts);
  }, []);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="border-b border-line bg-surface px-5 pb-4 pt-5">
        <Text className="text-xl font-heading text-ink">Record a sale</Text>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 96 }}
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
                <Pressable
                  onPress={() => changeQuantity(item.id, -1)}
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-full border border-line bg-background"
                >
                  <Ionicons name="remove" size={18} color={colors.text} />
                </Pressable>
              )}
              {qty > 0 && (
                <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-brand px-1.5">
                  <Text className="font-manrope-bold text-xs text-brand-ink">{qty}</Text>
                </View>
              )}
              <Pressable
                onPress={() => addProduct(item)}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full bg-brand"
              >
                <Ionicons name="add" size={18} color={colors.onPrimary} />
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text className="px-5 py-6 font-sans text-[13px] text-ink-faint">
            No products cached yet. Connect once to load the catalog.
          </Text>
        }
      />

      {cart.length > 0 && (
        <Pressable
          onPress={() => router.push("/sale-review")}
          className="absolute flex-row items-center gap-2 rounded-full bg-brand px-5 py-4 shadow-lg"
          style={{ right: 20, bottom: insets.bottom + 20 }}
        >
          <View className="h-6 min-w-[24px] items-center justify-center rounded-full bg-black/15 px-1.5">
            <Text className="font-manrope-bold text-xs text-brand-ink">{cart.length}</Text>
          </View>
          <Text className="font-manrope-bold text-[15px] text-brand-ink">Review sale</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
        </Pressable>
      )}
    </View>
  );
}
