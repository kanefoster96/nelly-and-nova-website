import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { LoadingState, SectionLabel } from "@/components/ui";
import { listRefundsOwed, listRequests, listUnpaid, markRefundDone, pounds, type RefundOwed, type SessionRequest, type UnpaidSession } from "@/data/sessions";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

import { RequestCard, UnpaidCard } from "./request-card";

/**
 * Session requests. A trainer: what's waiting (Accept / Suggest / Decline),
 * refunds to do by hand in GoCardless (ticked off with Done), sessions
 * still to pay (Charge / Mark paid / Waive) and what's been
 * decided lately. An owner: all of their own requests. With `id` (a
 * notification or a chat line's /requests/<id>), just that one.
 */
export function RequestsScreen({ id }: { id?: string }) {
  const { isTrainer } = useAuth();
  const [requests, setRequests] = useState<SessionRequest[] | null>(null);
  const [unpaid, setUnpaid] = useState<UnpaidSession[]>([]);
  const [refunds, setRefunds] = useState<RefundOwed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, u, f] = await Promise.all([
        listRequests({ withOwners: isTrainer, id }),
        isTrainer && !id ? listUnpaid() : Promise.resolve([] as UnpaidSession[]),
        isTrainer && !id ? listRefundsOwed() : Promise.resolve([] as RefundOwed[]),
      ]);
      setRequests(r);
      setUnpaid(u);
      setRefunds(f);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the requests.");
    }
  }, [isTrainer, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changed = (message?: string) => {
    if (message) setDone(message);
    load();
  };

  const open = (requests ?? []).filter((r) => r.status === "pending" || r.status === "offered");
  const decided = (requests ?? []).filter((r) => r.status !== "pending" && r.status !== "offered").slice(0, 30);
  const role = isTrainer ? "trainer" : "owner";
  const pendingCount = open.filter((r) => r.status === "pending").length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={id ? "Request" : isTrainer ? "Requests" : "My requests"}
        subtitle={!id && isTrainer ? (pendingCount ? `${pendingCount} waiting for you` : "Nothing waiting") : null}
      />
      {!requests ? (
        <LoadingState error={error} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.foreground}
            />
          }
        >
          {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}
          {done && (
            <View style={{ borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <Text style={{ color: colors.success, fontSize: 13 }}>{done}</Text>
            </View>
          )}
          {id && requests.length === 0 && <Text style={{ color: colors.muted, marginTop: 12 }}>That request isn&apos;t there any more.</Text>}

          {!id && <SectionLabel>{isTrainer ? "Waiting" : "Open"}</SectionLabel>}
          {!id && open.length === 0 && <Text style={{ color: colors.muted, fontSize: 14 }}>{isTrainer ? "No requests waiting." : "Nothing open."}</Text>}
          <View style={{ gap: 10 }}>
            {(id ? requests : open).map((r, i) => (
              <Appear key={r.id} index={i}>
                <RequestCard request={r} role={role} onChanged={changed} />
              </Appear>
            ))}
          </View>

          {refunds.length > 0 && (
            <>
              <SectionLabel>{`${refunds.length} refund${refunds.length === 1 ? "" : "s"} to do`}</SectionLabel>
              <View style={{ gap: 10 }}>
                {refunds.map((f) => (
                  <RefundCard key={f.id} refund={f} onChanged={changed} />
                ))}
              </View>
            </>
          )}

          {unpaid.length > 0 && (
            <>
              <SectionLabel>{`${unpaid.length} unpaid session${unpaid.length === 1 ? "" : "s"}`}</SectionLabel>
              <View style={{ gap: 10 }}>
                {unpaid.map((s) => (
                  <UnpaidCard key={s.id} session={s} onChanged={changed} />
                ))}
              </View>
            </>
          )}

          {!id && decided.length > 0 && (
            <>
              <SectionLabel>Decided</SectionLabel>
              <View style={{ gap: 10 }}>
                {decided.map((r) => (
                  <RequestCard key={r.id} request={r} role={role} onChanged={changed} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * A refund to do by hand: GoCardless refunds may not be switched on for the
 * account, so nothing here calls them. Do it in the GoCardless dashboard,
 * then tick Done.
 */
function RefundCard({ refund: f, onChanged }: { refund: RefundOwed; onChanged: (message?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const who = f.ownerName?.split(" ")[0] || "the owner";
  async function done() {
    setBusy(true);
    try {
      await markRefundDone(f.id);
      hapticSuccess();
      onChanged(`Refund to ${who} ticked off.`);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, ...GLASS_BORDER, borderRadius: 18, backgroundColor: colors.surface, padding: 16 }}>
      <Ionicons name="arrow-undo-circle-outline" size={26} color={colors.warning} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>
          Refund {pounds(f.amountPence)} to {who} in GoCardless
        </Text>
        {!!f.reason && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{f.reason}</Text>}
      </View>
      <Pressable
        onPress={done}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border }}
      >
        {busy ? <ActivityIndicator size="small" color={colors.foreground} /> : <Ionicons name="checkmark" size={16} color={colors.foreground} />}
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Done</Text>
      </Pressable>
    </View>
  );
}
