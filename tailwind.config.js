/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Mirrors vatflow-web's dark ledger theme (src/app/globals.css) so both
      // apps read as one product.
      colors: {
        background: "#0f1613",
        surface: "#171f1b",
        "surface-alt": "#1e2723",
        line: "#2a332d",
        ink: "#edeae0",
        "ink-soft": "#9ca79e",
        "ink-faint": "#6b756e",
        brand: "#2aa57f",
        "brand-ink": "#08130f",
        accent: "#e0a648",
        "accent-ink": "#241505",
        danger: "#e5584a",
        "danger-soft": "#3a1712",
        success: "#3fbe55",
        "success-soft": "#173622",
        warning: "#d9a441",
        "warning-soft": "#3a2e12",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
      },
      // Same type system as vatflow-web: Inter for text and headings, Geist
      // Mono for data. Each token maps straight to one loaded weight — React
      // Native has no font-weight synthesis for custom fonts, so don't pair
      // these with font-bold/font-semibold, use the matching weight token.
      fontFamily: {
        sans: ["Inter_400Regular"],
        "sans-medium": ["Inter_500Medium"],
        "sans-semibold": ["Inter_600SemiBold"],
        "sans-bold": ["Inter_700Bold"],
        "sans-extrabold": ["Inter_800ExtraBold"],
        "heading-semibold": ["Inter_600SemiBold"],
        heading: ["Inter_700Bold"],
        "heading-extrabold": ["Inter_800ExtraBold"],
        mono: ["GeistMono_500Medium"],
        "mono-semibold": ["GeistMono_600SemiBold"],
      },
    },
  },
  plugins: [],
};
