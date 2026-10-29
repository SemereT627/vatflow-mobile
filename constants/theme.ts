// Mirrors vatflow-web's dark ledger theme (src/app/globals.css) — same hex
// values, same roles, so the two apps read as one product.
export const colors = {
  background: "#0f1613",
  surface: "#171f1b",
  surfaceAlt: "#1e2723",
  border: "#2a332d",
  text: "#edeae0",
  textMuted: "#9ca79e",
  textFaint: "#6b756e",
  primary: "#2aa57f",
  onPrimary: "#08130f",
  accent: "#e0a648",
  onAccent: "#241505",
  danger: "#e5584a",
  dangerSoft: "#3a1712",
  success: "#3fbe55",
  successSoft: "#173622",
  warning: "#d9a441",
  warningSoft: "#3a2e12",
};

export const spacing = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, xxl: 40 };
export const radius = { sm: 6, md: 10, lg: 16 };

// Same type system as vatflow-web (and Kiln): Inter for text and headings,
// Geist Mono for data. These strings are the exact @expo-google-fonts export
// names loaded in app/_layout.tsx — React Native has no font-weight synthesis
// for custom fonts, so each weight is its own family.
export const fonts = {
  headingSemibold: "Inter_600SemiBold",
  heading: "Inter_700Bold",
  headingExtrabold: "Inter_800ExtraBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  bodyExtrabold: "Inter_800ExtraBold",
  mono: "GeistMono_500Medium",
  monoSemibold: "GeistMono_600SemiBold",
};
