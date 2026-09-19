import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { runSaleSync } from "@/lib/sync";
import { useAuth } from "@/context/auth-context";

/** Triggers the sync engine on reconnect, app foreground, and mount. */
export function useAutoSync(onSyncComplete?: () => void) {
  const { session } = useAuth();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!session) return;

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      if (isOnline && wasOffline.current) {
        runSaleSync().then(onSyncComplete);
      }
      wasOffline.current = !isOnline;
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        runSaleSync().then(onSyncComplete);
      }
    });

    runSaleSync().then(onSyncComplete);

    return () => {
      unsubscribeNet();
      appStateSub.remove();
    };
  }, [session, onSyncComplete]);
}
