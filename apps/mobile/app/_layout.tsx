import { Slot } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../src/providers/SessionProvider";
import { queryClient } from "../src/lib/queryClient";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Slot />
        </QueryClientProvider>
      </SessionProvider>
    </GestureHandlerRootView>
  );
}
