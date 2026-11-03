import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, View } from "react-native";

import { Pressable } from "@/components/pressable";
import {
  chargeSession,
  decideRequest,
  defaultSessionPrice,
  getAvailability,
  hasMembership,
  isRegularKind,
  moveSession,
  pickOffer,
  plural,
  plusDays,
  pounds,
  requestDetail,
  requestTitle,
  setPaymentStatus,
  shortDate,
  STATUS_LABEL,
  todayLondon,
  weekdayOf,
  withdrawRequest,
  type Availability,
  type SessionRequest,
  type UnpaidSession,
} from "@/data/sessions";
import { conversationForAccount } from "@/data/trainer-schedule";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

import { DateGrid } from "./date-grid";

const TONE: Record<SessionRequest["status"], string> = {
  pending: colors.foreground,
  offered: colors.warning,
  confirmed: colors.success,
  declined: colors.muted,
  withdrawn: colors.muted,
};

function SmallButton({ label, onPress, solid, busy, tone }: { label: string; onPress: () => void; solid?: boolean; busy?: boolean; tone?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => ({
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: solid ? colors.accent : "transparent",
        borderWidth: solid ? 0 : 1,
        borderColor: tone ?? colors.border,
        opacity: pressed || busy ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={solid ? colors.accentForeground : colors.muted} />
      ) : (
        <Text style={{ color: solid ? colors.accentForeground : (tone ?? colors.foreground), fontSize: 13, fontWeight: "700" }}>{label}</Text>
      )}
    </Pressable>
  );
}

function offerLabel(r: SessionRequest, d: string): string {
  return isRegularKind(r.kind) ? `${plural(weekdayOf(d))} from ${shortDate(d)}` : shortDate(d);
}

/**
 * One session request, for its owner or a trainer.
 * Owner: where it's got to; the trainer's offered days to tap (booked
 *   straight away); Withdraw while it's open; Message about this.
 * Trainer: Accept, Suggest (1–3 days, with how full each is) or Decline
 *   (a note either way); a confirmed one-off can be moved (Edit date);
 *   Message about this opens the owner's chat.
 */
export function RequestCard({ request: r, role, onChanged }: { request: SessionRequest; role: "owner" | "trainer"; onChanged: (message?: string) => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "suggest" | "decline" | "move">("idle");
  const [dates, setDates] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>({});
  const today = todayLondon();
  const open = r.status === "pending" || r.status === "offered";

  useEffect(() => {
    if (mode !== "suggest" && mode !== "move") return;
    let live = true;
    getAvailability(plusDays(today, 1), plusDays(today, 56))
      .then((a) => live && setAvailability(a))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [mode, today]);

  async function run(key: string, action: () => Promise<void>, message: string) {
    setBusy(key);
    try {
      await action();
      hapticSuccess();
      animateListChange();
      setMode("idle");
      onChanged(message);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function message() {
    if (role === "owner") return router.push("/chat");
    try {
      const id = await conversationForAccount(r.accountId);
      router.push({ pathname: "/conversation/[id]", params: { id } });
    } catch (err) {
      Alert.alert("Couldn't open their chat", err instanceof Error ? err.message : "Please try again.");
    }
  }

  const when = r.confirmedDate && r.status === "confirmed" ? (isRegularKind(r.kind) ? `${plural(r.confirmedDay)} from ${shortDate(r.confirmedDate)}` : shortDate(r.confirmedDate)) : null;
  const canMove = role === "trainer" && r.status === "confirmed" && !!r.resultBookingId && !!r.confirmedDate && r.confirmedDate >= today;

  return (
    <View style={{ borderWidth: 1, ...GLASS_BORDER, borderRadius: 18, backgroundColor: colors.surface, padding: 16, opacity: open || r.status === "confirmed" ? 1 : 0.7 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TONE[r.status] }} />
        <Text style={{ color: TONE[r.status], fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", flex: 1 }}>
          {role === "trainer" && r.status === "offered" ? "Offered · waiting for owner" : STATUS_LABEL[r.status]}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{shortDate(r.createdAt.slice(0, 10))}</Text>
      </View>
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 8 }}>
        {role === "trainer" ? `${r.dogName}${r.ownerName ? ` · ${r.ownerName}` : ""}` : `${requestTitle(r)} for ${r.dogName}`}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>
        {role === "trainer" ? `${requestTitle(r)} · ` : ""}
        {requestDetail(r)}
      </Text>
      {when && <Text style={{ color: colors.success, fontSize: 14, fontWeight: "600", marginTop: 4 }}>Booked: {when}</Text>}
      {!!r.note && <Text style={{ color: colors.foreground, fontSize: 14, marginTop: 8, lineHeight: 20 }}>“{r.note}”</Text>}
      {!!r.decisionNote && (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
          {role === "owner" ? "Trainer: " : "Your note: "}
          {r.decisionNote}
        </Text>
      )}

      {/* The trainer's offers. */}
      {r.status === "offered" && (
        <View style={{ marginTop: 12, gap: 8 }}>
          {role === "owner" && <Text style={{ color: colors.foreground, fontSize: 14 }}>We can do one of these. Tap one to book it:</Text>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {r.offeredDates.map((d) =>
              role === "owner" ? (
                <SmallButton key={d} label={offerLabel(r, d)} solid busy={busy === d} onPress={() => run(d, () => pickOffer(r.id, d), `Booked ${shortDate(d)} for ${r.dogName}.`)} />
              ) : (
                <Text key={d} style={{ color: colors.warning, fontSize: 13, borderWidth: 1, borderColor: colors.warning, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  {offerLabel(r, d)}
                </Text>
              ),
            )}
          </View>
        </View>
      )}

      {mode === "suggest" && (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 10 }}>
            Pick up to 3 {isRegularKind(r.kind) ? "start dates (their weekday becomes the regular day)" : "days"}. The owner taps one to book it.
          </Text>
          <DateGrid availability={availability} selected={dates} onChange={setDates} after={today} max={3} allowFull showCounts />
        </View>
      )}
      {mode === "move" && (
        <View style={{ marginTop: 14 }}>
          <DateGrid availability={availability} selected={dates} onChange={setDates} after={plusDays(today, -1)} allowFull showCounts />
        </View>
      )}
      {(mode === "suggest" || mode === "decline" || mode === "move") && (
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={mode === "decline" ? "Reason (optional)" : "Note for the owner (optional)"}
          placeholderTextColor={colors.muted}
          maxLength={500}
          style={{ marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 15 }}
        />
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {role === "trainer" && open && mode === "idle" && (
          <>
            {r.status === "pending" && <SmallButton label="Accept" solid busy={busy === "accept"} onPress={() => run("accept", () => decideRequest(r.id, "accept"), `Confirmed. ${r.ownerName ?? "The owner"} has been told.`)} />}
            <SmallButton
              label="Suggest"
              onPress={() => {
                animateListChange();
                setDates([]);
                setMode("suggest");
              }}
            />
            <SmallButton
              label="Decline"
              tone={colors.muted}
              onPress={() => {
                animateListChange();
                setMode("decline");
              }}
            />
          </>
        )}
        {mode === "suggest" && (
          <SmallButton
            label={`Offer ${dates.length || ""} day${dates.length === 1 ? "" : "s"}`}
            solid
            busy={busy === "suggest"}
            onPress={() => (dates.length ? run("suggest", () => decideRequest(r.id, "suggest", dates, note), `Offered ${dates.map(shortDate).join(", ")}.`) : Alert.alert("Pick at least one day"))}
          />
        )}
        {mode === "decline" && <SmallButton label="Decline request" solid busy={busy === "decline"} onPress={() => run("decline", () => decideRequest(r.id, "decline", [], note), "Declined. They've been told.")} />}
        {mode === "move" && (
          <SmallButton
            label="Move session"
            solid
            busy={busy === "move"}
            onPress={() =>
              dates[0]
                ? run("move", () => moveSession({ dogId: r.dogId, from: r.confirmedDate!, to: dates[0], bookingId: r.resultBookingId, note }), `Moved to ${shortDate(dates[0])}. They've been told.`)
                : Alert.alert("Pick the new day")
            }
          />
        )}
        {mode !== "idle" && (
          <SmallButton
            label="Back"
            tone={colors.muted}
            onPress={() => {
              animateListChange();
              setMode("idle");
            }}
          />
        )}
        {canMove && mode === "idle" && (
          <SmallButton
            label="Edit date"
            onPress={() => {
              animateListChange();
              setDates([]);
              setMode("move");
            }}
          />
        )}
        {role === "owner" && open && (
          <SmallButton
            label={r.status === "offered" ? "None of these" : "Withdraw"}
            tone={colors.muted}
            busy={busy === "withdraw"}
            onPress={() =>
              Alert.alert(r.status === "offered" ? "Turn down these days?" : "Withdraw this request?", "You can always ask again.", [
                { text: "Keep", style: "cancel" },
                { text: r.status === "offered" ? "Turn down" : "Withdraw", style: "destructive", onPress: () => run("withdraw", () => withdrawRequest(r.id), "Request withdrawn.") },
              ])
            }
          />
        )}
        {mode === "idle" && (
          <Pressable onPress={message} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 6 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Message about this</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Trainer: a one-off session still to be paid. Charge takes it by Direct
 * Debit (only when tapped; the amount is editable and starts at the
 * session price, the member price for members). Or Mark paid / Waive.
 */
export function UnpaidCard({ session: s, onChanged }: { session: UnpaidSession; onChanged: (message?: string) => void }) {
  const [member, setMember] = useState<boolean | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (s.accountId ? hasMembership(s.accountId) : Promise.resolve(false)).then((m) => {
      if (!live) return;
      setMember(m);
      const pence = s.amountPence ?? defaultSessionPrice(s.kind, m);
      setAmount((prev) => prev || String(pence % 100 === 0 ? pence / 100 : (pence / 100).toFixed(2)));
    });
    return () => {
      live = false;
    };
  }, [s.accountId, s.amountPence, s.kind]);

  const pence = Math.round(Number(amount) * 100);

  async function run(key: string, action: () => Promise<string>) {
    setBusy(key);
    try {
      const message = await action();
      hapticSuccess();
      onChanged(message);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ borderWidth: 1, ...GLASS_BORDER, borderRadius: 18, backgroundColor: colors.surface, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700", flex: 1 }}>
          {s.dogName ?? "Dog"} · {s.kind === "one_to_one" ? "1-1" : "Full Day"} · {shortDate(s.date)}
        </Text>
        <Text style={{ color: s.paymentStatus === "failed" ? colors.danger : colors.warning, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
          {s.paymentStatus === "failed" ? "FAILED" : "UNPAID"}
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>
        {s.ownerName ?? "Owner"}
        {s.notes ? ` · ${s.notes}` : ""}
        {member !== null ? ` · ${pounds(defaultSessionPrice(s.kind, member))}${s.kind === "full_day" && member ? " · member price" : ""}` : ""}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12 }}>
          <Text style={{ color: colors.foreground, fontSize: 15 }}>£</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount in pounds"
            style={{ color: colors.foreground, fontSize: 15, minWidth: 44, paddingVertical: 0, marginLeft: 2 }}
          />
        </View>
        <SmallButton
          label={`Charge £${amount || "?"}`}
          solid
          busy={busy === "charge"}
          onPress={() =>
            pence >= 100
              ? Alert.alert(`Charge £${amount}?`, `By Direct Debit to ${s.ownerName ?? "the owner"}, for ${s.dogName ?? "their dog"}'s session on ${shortDate(s.date)}.`, [
                  { text: "Not now", style: "cancel" },
                  {
                    text: "Charge",
                    onPress: () =>
                      run("charge", async () => {
                        const charged = await chargeSession(s.id, pence);
                        return `Charged ${pounds(charged)}. It shows as paid once GoCardless confirms it.`;
                      }),
                  },
                ])
              : Alert.alert("Enter an amount")
          }
        />
        <SmallButton
          label="Mark paid"
          busy={busy === "paid"}
          onPress={() =>
            run("paid", async () => {
              await setPaymentStatus(s.id, "paid");
              return "Marked paid.";
            })
          }
        />
        <SmallButton
          label="Waive"
          tone={colors.muted}
          busy={busy === "waive"}
          onPress={() =>
            run("waive", async () => {
              await setPaymentStatus(s.id, "waived");
              return "Waived.";
            })
          }
        />
      </View>
    </View>
  );
}
