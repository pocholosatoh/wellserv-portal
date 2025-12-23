import { Slot } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { SessionProvider } from "../src/providers/SessionProvider";
import { queryClient } from "../src/lib/queryClient";

console.log(
  "GADApplicationIdentifier",
  Constants.expoConfig?.ios?.infoPlist?.GADApplicationIdentifier
);
console.log("iOS infoPlist", Constants.expoConfig?.ios?.infoPlist);

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
