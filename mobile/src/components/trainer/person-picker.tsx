import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarCircle } from "@/components/avatar-circle";
import { GlassButton } from "@/components/glass-button";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { BigButton } from "@/components/trainer/cards";
import { FormScrollView, Tag, TextField } from "@/components/ui";
import { addPerson, customerMatches, listCustomers, listOpenRequests, requestMatches, type Customer, type OpenRequest, type Picked, type PickerDog } from "@/data/people";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

type Tab = "customers" | "requests" | "new";

const STATUS_LABEL: Record<OpenRequest["status"], string> = {
  new: "New",
  meet_greet_booked: "Meet & greet booked",
  onboarding: "Onboarding",
};

export function ListBox({ children }: { children: React.ReactNode }) {
  return <View style={{ borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 18, overflow: "hidden" }}>{children}</View>;
}

/** One row to choose: photo or initials, a name and a line under it, and a tick or a note. */
export function PickRow({
  title,
  subtitle,
  avatar,
  selected,
  note,
  noteTone,
  disabled,
  trailing,
  onPress,
  first,
  inset = false,
}: {
  title: string;
  subtitle?: string | null;
  avatar?: { name: string; url: string | null };
  selected?: boolean;
  /** A tag at the end: "Not registered", "Already in". */
  note?: string;
  noteTone?: string;
  disabled?: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
  first: boolean;
  /** A dog under its owner: indented. */
  inset?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={[title, subtitle, note].filter(Boolean).join(", ")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingLeft: inset ? 30 : 14,
        paddingRight: 14,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        backgroundColor: selected ? "rgba(34,197,94,0.08)" : "transparent",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {avatar && <AvatarCircle name={avatar.name} avatarUrl={avatar.url} size={inset ? 32 : 36} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!note && <Tag label={note} tone={noteTone} />}
      {trailing ?? (selected !== undefined ? <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.success : colors.muted} /> : null)}
    </Pressable>
  );
}

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const options: { value: Tab; label: string }[] = [
    { value: "customers", label: "Customers" },
    { value: "requests", label: "Requests" },
    { value: "new", label: "New person" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (on) return;
              hapticSelection();
              animateListChange();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 999, backgroundColor: on ? colors.accent : "transparent" }}
          >
            <Text style={{ color: on ? colors.accentForeground : colors.foreground, fontSize: 13, fontWeight: "700" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Who it's for, as a sheet — shared by a day's Add new dog, Add a 1-1 and
 * Add a meet & greet, so whatever's booked is on the owner's account and
 * shows in their app.
 *  - Customers: search by name, email or dog; tap a customer for their
 *    dogs (registered, or "Not registered"), and tap the dog.
 *  - Requests: an open request (a meet & greet request from the website).
 *  - New person: name, email and phone, saved as a request so they can be
 *    onboarded later.
 * `allowNoDog`: a customer can be chosen without a dog (a meet & greet, or
 * someone who hasn't added theirs yet). `alreadyIn`: dogs already booked
 * that day, shown but not choosable.
 */
export function PersonPicker({
  visible,
  onClose,
  onPick,
  service,
  allowNoDog = false,
  alreadyIn,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (p: Picked) => void;
  /** What a new person's request is for: "Full Day Training", "1-1 Training". */
  service: string;
  allowNoDog?: boolean;
  alreadyIn?: Set<string>;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("customers");
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [requests, setRequests] = useState<OpenRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [person, setPerson] = useState({ name: "", email: "", phone: "", dogNames: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    listCustomers()
      .then(setCustomers)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the customers."));
    listOpenRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, [visible]);

  const shownCustomers = useMemo(() => (customers ?? []).filter((c) => customerMatches(c, query)).slice(0, 40), [customers, query]);
  const shownRequests = useMemo(() => (requests ?? []).filter((r) => requestMatches(r, query)).slice(0, 40), [requests, query]);

  function pick(p: Picked) {
    hapticSelection();
    onPick(p);
    onClose();
  }

  async function saveNew() {
    if (saving) return;
    setSaving(true);
    try {
      const p = await addPerson({ ...person, service }, customers);
      hapticSuccess();
      if (p.type === "customer") Alert.alert("They're already a customer", `${p.customer.name} has an account with that email, so it's booked on their account.`);
      else if (!p.isNew) Alert.alert("They've already asked", `${p.request.name} has an open request with that email, so it's booked on that.`);
      setPerson({ name: "", email: "", phone: "", dogNames: "" });
      onPick(p);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      if (/^Add /.test(message)) hapticWarning();
      else hapticError();
      Alert.alert(/^Add /.test(message) ? "Nearly there" : "That didn't go through", message);
    } finally {
      setSaving(false);
    }
  }

  function dogRow(c: Customer, d: PickerDog, first: boolean) {
    const inAlready = alreadyIn?.has(d.id);
    return (
      <PickRow
        key={d.id}
        first={first}
        inset
        title={d.name}
        subtitle={d.breed}
        avatar={{ name: d.name, url: d.photoUrl }}
        note={inAlready ? "Already in" : d.registered ? "Registered" : "Not registered"}
        noteTone={inAlready ? undefined : d.registered ? colors.success : colors.warning}
        disabled={inAlready}
        onPress={() => pick({ type: "customer", customer: c, dog: d })}
        trailing={<Ionicons name="chevron-forward" size={16} color={colors.muted} />}
      />
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <GlassButton onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.foreground} />
          </GlassButton>
        </View>
        <PageTitle title="Who's it for?" subtitle="It goes on their account, so they see it in their app." style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 }} />
        <View style={{ paddingHorizontal: 20 }}>
          <Tabs value={tab} onChange={setTab} />
        </View>
        <FormScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 40 }}>
          {tab !== "new" && (
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={tab === "customers" ? "Search by name, email or dog" : "Search the requests"}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          )}
          {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

          {tab === "customers" &&
            (!customers ? (
              <ActivityIndicator color={colors.foreground} style={{ marginVertical: 20 }} />
            ) : (
              <>
                <ListBox>
                  {shownCustomers.length === 0 && (
                    <Text style={{ color: colors.muted, fontSize: 14, padding: 14 }}>{query.trim() ? `No customer matches “${query.trim()}”.` : "No customers yet."}</Text>
                  )}
                  {shownCustomers.map((c, i) => {
                    const expanded = open === c.accountId || (!!query.trim() && shownCustomers.length === 1);
                    const dogLine = c.dogs.length ? c.dogs.map((d) => d.name).join(", ") : "No dogs yet";
                    return (
                      <View key={c.accountId}>
                        <PickRow
                          first={i === 0}
                          title={c.name}
                          subtitle={[dogLine, c.email].filter(Boolean).join(" · ")}
                          avatar={{ name: c.name, url: null }}
                          onPress={() => {
                            hapticSelection();
                            animateListChange();
                            setOpen(expanded ? null : c.accountId);
                          }}
                          trailing={<Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />}
                        />
                        {expanded && (
                          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: "rgba(245,245,242,0.03)" }}>
                            {c.dogs.map((d, j) => dogRow(c, d, j === 0))}
                            {(allowNoDog || c.dogs.length === 0) && (
                              <PickRow
                                first={c.dogs.length === 0}
                                inset
                                title={c.dogs.length === 0 ? `Book ${c.name}` : `Just ${c.name}`}
                                subtitle={c.dogs.length === 0 ? "Their dog fills in once they add and register it" : "Not for one dog in particular"}
                                onPress={() => pick({ type: "customer", customer: c, dog: null })}
                                trailing={<Ionicons name="chevron-forward" size={16} color={colors.muted} />}
                              />
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ListBox>
                {customers.length > shownCustomers.length && !query.trim() && (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Showing the first {shownCustomers.length} A–Z. Search to find the rest.</Text>
                )}
              </>
            ))}

          {tab === "requests" &&
            (!requests ? (
              <ActivityIndicator color={colors.foreground} style={{ marginVertical: 20 }} />
            ) : (
              <ListBox>
                {shownRequests.length === 0 && <Text style={{ color: colors.muted, fontSize: 14, padding: 14 }}>{query.trim() ? `No request matches “${query.trim()}”.` : "No open requests."}</Text>}
                {shownRequests.map((r, i) => (
                  <PickRow
                    key={r.id}
                    first={i === 0}
                    title={r.name}
                    subtitle={[r.dogNames, r.service, STATUS_LABEL[r.status]].filter(Boolean).join(" · ")}
                    avatar={{ name: r.name, url: null }}
                    note={r.accountId ? "Has the app" : undefined}
                    noteTone={colors.success}
                    onPress={() => pick({ type: "request", request: r })}
                    trailing={<Ionicons name="chevron-forward" size={16} color={colors.muted} />}
                  />
                ))}
              </ListBox>
            ))}

          {tab === "new" && (
            <>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                They&apos;re saved as a request on the Onboarding board, so you can send them their join link later.
              </Text>
              <TextField value={person.name} onChangeText={(v) => setPerson((p) => ({ ...p, name: v }))} placeholder="Their name" autoCapitalize="words" textContentType="name" />
              <TextField value={person.email} onChangeText={(v) => setPerson((p) => ({ ...p, email: v }))} placeholder="Email" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
              <TextField value={person.phone} onChangeText={(v) => setPerson((p) => ({ ...p, phone: v }))} placeholder="Phone" keyboardType="phone-pad" textContentType="telephoneNumber" />
              <TextField value={person.dogNames} onChangeText={(v) => setPerson((p) => ({ ...p, dogNames: v }))} placeholder="Their dog's name (optional)" autoCapitalize="words" />
              <BigButton icon="person-add-outline" label="Save and choose" onPress={saveNew} busy={saving} style={{ marginTop: 8 }} />
            </>
          )}
        </FormScrollView>
      </View>
    </Modal>
  );
}
