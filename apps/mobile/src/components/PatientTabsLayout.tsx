import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { colors, spacing } from "@wellserv/theme";
import { PatientTabsHeader, type PatientTabKey } from "./PatientTabsHeader";

type RenderChildren = (contentContainerStyle: ViewStyle) => ReactNode;

interface PatientTabsLayoutProps {
  activeTab: PatientTabKey;
  onTabPress: (tab: PatientTabKey) => void;
  children: RenderChildren;
}

export const patientTabsContentContainerStyle: ViewStyle = {
  paddingHorizontal: spacing.lg,
  paddingTop: 0,
  paddingBottom: spacing.xl,
};

export function PatientTabsLayout({ activeTab, onTabPress, children }: PatientTabsLayoutProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "left", "right"]}>
      <Stack.Screen
        options={{
          headerShown: false,
          headerShadowVisible: false,
          title: "",
        }}
      />
      <PatientTabsHeader activeTab={activeTab} onTabPress={onTabPress} />
      <View style={{ flex: 1 }}>{children(patientTabsContentContainerStyle)}</View>
    </SafeAreaView>
  );
}
