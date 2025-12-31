import { useEffect, useRef } from "react";
import { ScrollView, Text, TouchableOpacity, View, ViewStyle, TextStyle } from "react-native";
import { colors, spacing } from "@wellserv/theme";

export type PatientTabKey =
  | "home"
  | "results"
  | "logs"
  | "prescriptions"
  | "followups"
  | "pharmacy";

interface PatientTabsHeaderProps {
  activeTab: PatientTabKey;
  onTabPress: (tab: PatientTabKey) => void;
}

const tabs: { key: PatientTabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "results", label: "Results" },
  { key: "logs", label: "Logs" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "followups", label: "Follow-ups" },
  { key: "pharmacy", label: "Online Pharmacy" },
];

export function PatientTabsHeader({ activeTab, onTabPress }: PatientTabsHeaderProps) {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollXRef = useRef(0);
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const tabLayoutRef = useRef<Partial<Record<PatientTabKey, { x: number; width: number }>>>({});

  useEffect(() => {
    const tabLayout = tabLayoutRef.current[activeTab];
    if (!scrollRef.current) return;
    if (!tabLayout) {
      scrollRef.current.scrollTo({ x: scrollXRef.current, animated: false });
      return;
    }

    const maxScroll = Math.max(0, contentWidthRef.current - containerWidthRef.current);
    const target = Math.min(Math.max(tabLayout.x - spacing.lg, 0), maxScroll);
    scrollRef.current.scrollTo({ x: target, animated: true });
  }, [activeTab]);

  return (
    <View style={{ backgroundColor: "transparent" }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        scrollEventThrottle={16}
        onLayout={(event) => {
          containerWidthRef.current = event.nativeEvent.layout.width;
        }}
        onContentSizeChange={(width) => {
          contentWidthRef.current = width;
        }}
        onScroll={(event) => {
          scrollXRef.current = event.nativeEvent.contentOffset.x;
        }}
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
              onLayout={(event) => {
                tabLayoutRef.current[tab.key] = {
                  x: event.nativeEvent.layout.x,
                  width: event.nativeEvent.layout.width,
                };
              }}
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
