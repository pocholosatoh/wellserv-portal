import { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, radii, spacing } from "@wellserv/theme";
import logo from "../../assets/wellserv-logo.png";

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Image
            source={logo}
            style={styles.logo}
            resizeMode="contain"
            alt="Wellserv logo"
          />
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.form}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderWidth: 1,
    borderColor: colors.gray[200],
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  logo: {
    width: "100%",
    height: 72,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSizes["2xl"],
    fontWeight: "700",
    color: "#111827",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.gray[600],
    marginBottom: spacing.lg,
  },
  form: {},
  footer: {
    marginTop: spacing.lg,
  },
});
