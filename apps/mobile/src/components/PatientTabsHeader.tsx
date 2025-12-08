import { ScrollView, Text, TouchableOpacity, View, ViewStyle, TextStyle } from "react-native";
import { colors, spacing } from "@wellserv/theme";

export type PatientTabKey = "home" | "results" | "prescriptions" | "followups" | "pharmacy";

interface PatientTabsHeaderProps {
  activeTab: PatientTabKey;
  onTabPress: (tab: PatientTabKey) => void;
}

const tabs: { key: PatientTabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "results", label: "Results" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "followups", label: "Follow-ups" },
  { key: "pharmacy", label: "Online Pharmacy" },
];

export function PatientTabsHeader({ activeTab, onTabPress }: PatientTabsHeaderProps) {
  return (
    <View style={{ backgroundColor: "transparent" }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: 0,
          paddingBottom: spacing.sm,
        }}
        contentContainerStyle={{
          flexDirection: "row",
          gap: spacing.sm,
          alignItems: "center",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const itemStyle: ViewStyle = {
            backgroundColor: isActive ? colors.primary : colors.gray[100],
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
          };
          const textStyle: TextStyle = {
            color: isActive ? "#fff" : colors.gray[700],
            fontWeight: isActive ? "700" : "600",
          };

          return (
            <TouchableOpacity
              key={tab.key}
              style={itemStyle}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.85}
            >
              <Text style={textStyle}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
