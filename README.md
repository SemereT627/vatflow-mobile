# VatFlow Mobile

The field companion to [VatFlow](../vatflow-web): an Expo app for sellers to record VAT
receipts on the go, offline-first, syncing to the web app when back online.

## Features

- **Record a sale** — pick products from the cached catalog, adjust quantity (decimal
  quantities supported — tap the quantity number to type an exact value, e.g. 2.35 m²)
  and price, add optional buyer name/TIN, review totals, and save.
- **Offline-first** — sales are queued in a local SQLite database (`expo-sqlite`) the
  moment they're recorded, so a seller can keep working with no connection.
- **Background sync** — queued sales sync to `vatflow-web`'s `/api/sales/sync` endpoint
  automatically; `NetInfo` detects connectivity changes and retries. Each sale carries a
  client-generated UUID so retried syncs can't double-insert.
- **History** — see every recorded sale's sync status (waiting, syncing, synced,
  rejected) and discard one that hasn't synced yet.
- **Auth** — Supabase email/password sessions persisted in `expo-secure-store` (device
  keychain), with explicit foreground/background token refresh since Supabase doesn't
  auto-refresh while backgrounded.

## Tech stack

Expo (SDK 57) · Expo Router · React Native 0.86 / React 19 · NativeWind (Tailwind for
RN) · Supabase JS client · expo-sqlite (offline queue)

## How it talks to the backend

This app does **not** query Supabase directly for sale/product data. It authenticates
with Supabase (for the session/bearer token), then calls `vatflow-web`'s own API routes
(`/api/products`, `/api/sales/sync`) with that token — so VAT math, shop scoping, and RLS
are enforced in one place (the web app), not duplicated between two clients.

## Getting started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the env example and fill in your Supabase project's values plus the web app's URL:

   ```bash
   cp .env.local.example .env.local
   ```

   | Variable | Description |
   | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `EXPO_PUBLIC_API_URL` | Base URL of the running `vatflow-web` instance (e.g. `http://localhost:3000` or your deployed URL) |

3. Run it:

   ```bash
   pnpm start        # Expo dev server — scan with Expo Go or a dev client
   pnpm android       # build + run on a connected device/emulator
   pnpm ios           # build + run on a connected device/simulator
   ```

   If `expo run:android` fails to talk to the emulator (`cannot write to emulator`),
   restart adb first: `adb kill-server && adb start-server`.

## Scripts

- `pnpm start` — Expo dev server
- `pnpm android` / `pnpm ios` — native build + run
- `pnpm web` — run in a browser (limited; this app targets native)

## Project structure

```text
app/(tabs)/index.tsx    New sale — product picker + cart
app/(tabs)/history.tsx  Synced/pending/rejected sale history
app/(tabs)/profile.tsx  Seller profile, shop info, sign out
app/sale-review.tsx     Cart review — buyer details, totals, save
app/login.tsx           Sign in
context/auth-context.tsx   Session state, sign in/out
context/cart-context.tsx   In-progress sale cart state
lib/supabase.ts         Supabase client (SecureStore-backed, foreground/background refresh)
lib/db.ts               SQLite offline queue + catalog/profile cache
lib/sync.ts             Pushes queued sales to vatflow-web, pulls catalog
lib/vat.ts              Shared VAT line-total math
```

## Building & releasing

EAS Build/Submit config lives in `eas.json` (production builds an Android APK). See the
[EAS Build docs](https://docs.expo.dev/build/introduction/) for the general workflow:
`eas build --platform android --profile production` / `eas submit`.
