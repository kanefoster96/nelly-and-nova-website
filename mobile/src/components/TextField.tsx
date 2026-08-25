import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/theme/colors";

type TextFieldProps = Omit<TextInputProps, "style" | "placeholderTextColor"> & {
  label: string;
  error?: string;
};

/** Labelled input matching the website's <Field> — dark, rounded, accent focus ring via border colour. */
export function TextField({ label, error, ...props }: TextFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor={colors.paperDim}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(245,242,234,0.9)",
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.paper,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontSize: 13,
    color: colors.danger,
  },
});
