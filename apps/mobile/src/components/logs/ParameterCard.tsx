import { Text, TouchableOpacity, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@wellserv/theme";

type ParameterCardProps = {
  title: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  isActive?: boolean;
  onPress?: () => void;
};

export function ParameterCard({ title, iconName, isActive, onPress }: ParameterCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: colors.gray[100],
        borderRadius: radii.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: colors.gray[200],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.gray[800] }}>{title}</Text>
          {isActive ? (
            <View
              style={{
                alignSelf: "flex-start",
                marginTop: spacing.xs,
                backgroundColor: colors.primaryLight,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radii.pill,
              }}
            >
              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>
                Active
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {iconName ? (
            <MaterialCommunityIcons name={iconName} size={22} color={colors.gray[600]} />
          ) : null}
          <Feather name="chevron-right" size={20} color={colors.gray[500]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
