import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCachedProfile, type CachedProduct, type SaleCartItem } from "@/lib/db";
import { DEFAULT_VAT_RATE } from "@/lib/vat";

type CartContextValue = {
  cart: SaleCartItem[];
  receiptNumber: string;
  buyerName: string;
  buyerTin: string;
  vatRate: number;
  setReceiptNumber: (value: string) => void;
  setBuyerName: (value: string) => void;
  setBuyerTin: (value: string) => void;
  addProduct: (product: CachedProduct) => void;
  changeQuantity: (productId: string, delta: number) => void;
  commitLineQuantity: (productId: string, text: string) => void;
  updateLineDescription: (productId: string, description: string) => void;
  updateLinePrice: (productId: string, priceText: string) => void;
  quantityInCart: (productId: string) => number;
  resetSale: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<SaleCartItem[]>([]);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerTin, setBuyerTin] = useState("");
  const [vatRate, setVatRate] = useState(DEFAULT_VAT_RATE);

  useEffect(() => {
    getCachedProfile().then((p) => {
      if (p) setVatRate(p.shop.vatRate);
    });
  }, []);

  function addProduct(product: CachedProduct) {
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
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((line) => (line.productId === productId ? { ...line, quantity: line.quantity + delta } : line))
        .filter((line) => line.quantity > 0)
    );
  }

  function commitLineQuantity(productId: string, text: string) {
    const parsed = parseFloat(text);
    const quantity = Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : NaN;
    if (quantity > 0) {
      setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
    }
  }

  function updateLineDescription(productId: string, description: string) {
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, description } : line)));
  }

  function updateLinePrice(productId: string, priceText: string) {
    setCart((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, unitPrice: parseFloat(priceText) || 0 } : line))
    );
  }

  function quantityInCart(productId: string): number {
    return cart.find((line) => line.productId === productId)?.quantity ?? 0;
  }

  function resetSale() {
    setCart([]);
    setReceiptNumber("");
    setBuyerName("");
    setBuyerTin("");
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        receiptNumber,
        buyerName,
        buyerTin,
        vatRate,
        setReceiptNumber,
        setBuyerName,
        setBuyerTin,
        addProduct,
        changeQuantity,
        commitLineQuantity,
        updateLineDescription,
        updateLinePrice,
        quantityInCart,
        resetSale,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
