import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors } from "@/theme/colors";

type Variant = "primary" | "secondary" | "ghost";

type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

/** Full-width pill button — accent fill / outline / plain text, matching the website's <Button>. */
export function Button({ title, variant = "primary", loading = false, disabled, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.accentInk : colors.paper} />
      ) : (
        <Text style={[styles.label, labelVariantStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(245,242,234,0.3)",
  },
  ghost: {
    backgroundColor: "transparent",
  },
});

const labelVariantStyles = StyleSheet.create({
  primary: {
    color: colors.accentInk,
  },
  secondary: {
    color: colors.paper,
  },
  ghost: {
    color: colors.paper,
  },
});
