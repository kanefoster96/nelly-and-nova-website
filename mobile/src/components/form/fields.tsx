import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Modal, ScrollView, Text, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/pressable";
import { hapticSelection } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

/*
 * The form pieces the register form, My Info and a dog's record share: the
 * website's Field, SelectCards, Checkbox and phone row, drawn the app's way
 * (dark cards, a red edge and message for anything that needs fixing).
 */

const LABEL = { color: colors.muted, fontSize: 13, marginBottom: 6 } as const;
const INPUT = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.foreground,
  fontSize: 16,
  backgroundColor: colors.surface,
} as const;

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <Text style={{ color: colors.danger, fontSize: 13, marginTop: 6 }}>{children}</Text>;
}

export function Label({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={LABEL}>
      {children}
      {required ? <Text style={{ color: colors.muted }}> *</Text> : null}
    </Text>
  );
}

export function Field({
  label,
  required,
  value,
  onChangeText,
  error,
  hint,
  multiline,
  keyboardType,
  ...rest
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
} & Omit<TextInputProps, "value" | "onChangeText" | "multiline" | "keyboardType">) {
  return (
    <View>
      <Label required={required}>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[INPUT, multiline && { minHeight: 84, textAlignVertical: "top", paddingTop: 12 }, !!error && { borderColor: "rgba(225,29,51,0.7)" }]}
        {...rest}
      />
      {hint && !error ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{hint}</Text> : null}
      <FieldError>{error}</FieldError>
    </View>
  );
}

/** Read-only, like the website's email box on My Info. */
export function StaticField({ label, value, icon }: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View>
      <Label>{label}</Label>
      <View style={[INPUT, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
        {icon && <Ionicons name={icon} size={16} color={colors.muted} />}
        <Text style={{ color: colors.muted, fontSize: 16, flex: 1 }}>{value || "—"}</Text>
      </View>
    </View>
  );
}

export type Option = { value: string; label: string };

/** The website's SelectCards: a row (or grid) of choices, one picked. */
export function Choice({
  label,
  required,
  options,
  value,
  onChange,
  error,
  columns,
}: {
  label?: string;
  required?: boolean;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
  columns?: number;
}) {
  return (
    <View>
      {label ? <Label required={required}>{label}</Label> : null}
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value || "none"}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                hapticSelection();
                onChange(o.value);
              }}
              style={{
                flexGrow: 1,
                flexBasis: columns ? `${Math.floor(100 / columns) - 3}%` : undefined,
                minWidth: columns ? undefined : 90,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: on ? colors.foreground : error ? "rgba(225,29,51,0.7)" : colors.border,
                backgroundColor: on ? "rgba(245,242,234,0.12)" : colors.surface,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: on ? "700" : "500" }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <FieldError>{error}</FieldError>
    </View>
  );
}

export const YES_NO: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export function Checkbox({ checked, onToggle, children, error }: { checked: boolean; onToggle: () => void; children: ReactNode; error?: string }) {
  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => {
          hapticSelection();
          onToggle();
        }}
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: checked ? colors.accent : error ? "rgba(225,29,51,0.7)" : "rgba(245,242,234,0.3)",
            backgroundColor: checked ? colors.accent : colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && <Ionicons name="checkmark" size={18} color={colors.accentForeground} />}
        </View>
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 21, flex: 1 }}>{children}</Text>
      </Pressable>
      <FieldError>{error}</FieldError>
    </View>
  );
}

/** A bottom sheet of choices (dial codes, countries, sex). */
export function OptionSheet({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  value: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable backdrop onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <Pressable
          backdrop
          onPress={() => {}}
          style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, ...GLASS_BORDER, paddingBottom: insets.bottom + 12, maxHeight: "70%" }}
        >
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
          </View>
          <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>{title}</Text>
          <ScrollView>
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value || "none"}
                  onPress={() => {
                    hapticSelection();
                    onPick(o.value);
                    onClose();
                  }}
                  style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colors.border }}
                >
                  <Text style={{ color: colors.foreground, fontSize: 16, flex: 1, fontWeight: on ? "700" : "400" }}>{o.label}</Text>
                  {on && <Ionicons name="checkmark" size={20} color={colors.foreground} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** A select box that opens an OptionSheet. */
export function SelectField({
  label,
  required,
  options,
  value,
  onChange,
  error,
  placeholder = "Select…",
}: {
  label: string;
  required?: boolean;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const shown = options.find((o) => o.value === value && o.value !== "")?.label;
  return (
    <View>
      <Label required={required}>{label}</Label>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown ?? "not chosen"}`}
        style={[INPUT, { flexDirection: "row", alignItems: "center" }, !!error && { borderColor: "rgba(225,29,51,0.7)" }]}
      >
        <Text style={{ color: shown ? colors.foreground : colors.muted, fontSize: 16, flex: 1 }}>{shown ?? placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <FieldError>{error}</FieldError>
      <OptionSheet visible={open} title={label} options={options.filter((o) => o.value !== "")} value={value} onPick={onChange} onClose={() => setOpen(false)} />
    </View>
  );
}

/** The website's phone row: a dial code and the number. */
export function PhoneRow({
  label,
  required,
  codes,
  code,
  number,
  onCode,
  onNumber,
  error,
}: {
  label: string;
  required?: boolean;
  codes: string[];
  code: string;
  number: string;
  onCode: (v: string) => void;
  onNumber: (v: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Label required={required}>{label}</Label>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label} country code ${code}`}
          style={[INPUT, { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 }]}
        >
          <Text style={{ color: colors.foreground, fontSize: 16 }}>{code}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          value={number}
          onChangeText={onNumber}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          style={[INPUT, { flex: 1 }, !!error && { borderColor: "rgba(225,29,51,0.7)" }]}
        />
      </View>
      <FieldError>{error}</FieldError>
      <OptionSheet visible={open} title={`${label} — country code`} options={codes.map((c) => ({ value: c, label: c }))} value={code} onPick={onCode} onClose={() => setOpen(false)} />
    </View>
  );
}

/** "DD/MM/YYYY" typed, YYYY-MM-DD out ("" until it's a real date). */
export function parseUkDate(text: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return "";
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1990) return "";
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function isoToUk(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Adds the slashes as they type: 0503 → 05/03. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateField({
  label,
  required,
  text,
  onChange,
  error,
}: {
  label: string;
  required?: boolean;
  text: string;
  /** The typed text, and the date it makes ("" if not a real date yet). */
  onChange: (text: string, iso: string) => void;
  error?: string;
}) {
  return (
    <Field
      label={label}
      required={required}
      value={text}
      onChangeText={(v) => {
        const masked = v.length < text.length ? v : maskDate(v);
        onChange(masked, parseUkDate(masked));
      }}
      placeholder="DD/MM/YYYY"
      keyboardType="number-pad"
      maxLength={10}
      error={error}
    />
  );
}
