import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { RefreshControl } from "@/components/refresh-control";
import { ScreenHeader } from "@/components/screen-header";
import { LoadingState, SectionLabel } from "@/components/ui";
import { listRequests, listUnpaid, type SessionRequest, type UnpaidSession } from "@/data/sessions";
import { colors } from "@/theme";

import { RequestCard, UnpaidCard } from "./request-card";

/**
 * Session requests. A trainer: what's waiting (Accept / Suggest / Decline),
 * sessions still to pay (Charge / Mark paid / Waive) and what's been
 * decided lately. An owner: all of their own requests. With `id` (a
 * notification or a chat line's /requests/<id>), just that one.
 */
export function RequestsScreen({ id }: { id?: string }) {
  const { isTrainer } = useAuth();
  const [requests, setRequests] = useState<SessionRequest[] | null>(null);
  const [unpaid, setUnpaid] = useState<UnpaidSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([listRequests({ withOwners: isTrainer, id }), isTrainer && !id ? listUnpaid() : Promise.resolve([] as UnpaidSession[])]);
      setRequests(r);
      setUnpaid(u);
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
