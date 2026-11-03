import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { GlassButton } from "@/components/glass-button";
import { MeetGreetCard } from "@/components/meet-greet-card";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { DayGroup, SessionCard } from "@/components/schedule/session-card";
import { SessionSheet } from "@/components/sessions/session-sheet";
import { LoadingState } from "@/components/ui";
import { getMyDogDetails, type DogDetails } from "@/data/dog-profile";
import {
  getDogSessions,
  getPlacements,
  hasMembership,
  isRegularKind,
  listRequests,
  longDate,
  plural,
  plusDays,
  requestTitle,
  sessionLabel,
  todayLondon,
  type DogSession,
  type Placement,
  type SessionRequest,
} from "@/data/sessions";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticSelection } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

type DogData = { dog: DogDetails; sessions: DogSession[]; placements: Placement[] };

const WEEKS_AHEAD = 10;

function paymentWord(s: DogSession): string | null {
  if (s.kind === "full_day") return null;
  if (s.paymentStatus === "paid") return "Paid";
  if (s.paymentStatus === "pending") return "Payment pending";
  return null;
}

/**
 * Member: Schedule. Their dogs' real sessions for the next ten weeks — the
 * regular days (from placements), one-off days and 1-1s (bookings) —
 * marked confirmed or cancelled, with the days they've asked for (pending)
 * faded in among them. Tapping a date opens the options sheet (cancel,
 * cancel and ask for a replacement, move it, switch the regular day); "+"
 * books a one-off or adds a regular day. The same sheet as the Profile tab.
 */
export function MemberSchedule() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const barScroll = useBarScroll();
  const barInset = useBarInset();
  const topInset = useTopBarInset();
  const [data, setData] = useState<DogData[] | null>(null);
  const [requests, setRequests] = useState<SessionRequest[]>([]);
  const [member, setMember] = useState(false);
  const [dogId, setDogId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ session: DogSession | null } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const today = todayLondon();
      const [dogs, reqs, m] = await Promise.all([getMyDogDetails(userId), listRequests({ open: true }).catch(() => []), hasMembership(userId).catch(() => false)]);
      const rows = await Promise.all(
        dogs.map(async (dog) => {
          const [sessions, placements] = await Promise.all([getDogSessions(dog.id, today, plusDays(today, WEEKS_AHEAD * 7)), getPlacements(dog.id)]);
          return { dog, sessions, placements };
        }),
      );
      setData(rows);
      setRequests(reqs);
      setMember(m);
      setError(null);
    } catch {
      setError("Could not load your schedule.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!data) return <LoadingState error={error} />;

  const current = data.find((d) => d.dog.id === dogId) ?? data[0] ?? null;
  const today = todayLondon();
  const pending = current ? requests.filter((r) => r.dogId === current.dog.id && !isRegularKind(r.kind) && r.requestedDate) : [];
  const dates = current ? [...new Set([...current.sessions.map((s) => s.date), ...pending.map((r) => r.requestedDate!)])].sort() : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        {...barScroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset, gap: 20 }}
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
        <PageTitle
          title="Schedule"
          style={{ marginBottom: -8 }}
          right={
            current ? (
              <GlassButton
                onPress={() => {
                  hapticSelection();
                  setDone(null);
                  setSheet({ session: null });
                }}
                accessibilityRole="button"
                accessibilityLabel="Book a session or add a regular day"
              >
                <Ionicons name="add" size={24} color={colors.foreground} />
              </GlassButton>
            ) : undefined
          }
        />
        <MeetGreetCard />
        {done && (
          <View style={{ borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 12, padding: 14 }}>
            <Text style={{ color: colors.success, fontSize: 13 }}>{done}</Text>
          </View>
        )}

        {data.length > 1 && (
          <View style={{ flexDirection: "row", borderRadius: 999, borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, padding: 4 }}>
            {data.map(({ dog }) => {
              const on = dog.id === current?.dog.id;
              return (
                <Pressable
                  key={dog.id}
                  onPress={() => {
                    hapticSelection();
                    animateListChange();
                    setDogId(dog.id);
                  }}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center", backgroundColor: on ? colors.foreground : "transparent" }}
                >
                  <Text style={{ color: on ? colors.background : colors.muted, fontSize: 14, fontWeight: "700" }}>{dog.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {!current || dates.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24 }}>
            No sessions booked yet. Once you&apos;re booked in they&apos;ll show here; tap + to ask for a day.
          </Text>
        ) : (
          <>
            {current.placements.length > 0 && (
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
                {current.dog.name} · Full Day Training {current.placements.map((p) => `${p.cadence === "alternating" ? "every other" : "every"} ${plural(p.day).replace(/s$/, "")}`).join(" and ")}. Tap a day to cancel or change it.
              </Text>
            )}
            {dates.map((date, i) => {
              const daySessions = current.sessions.filter((s) => s.date === date);
              const asked = pending.filter((r) => r.requestedDate === date);
              const first = current.sessions.find((s) => !s.cancelled && s.date >= today);
              return (
                <Appear key={date} index={Math.min(i, 8)}>
                  <DayGroup heading={longDate(date)}>
                    {daySessions.map((s) => {
                      const pay = paymentWord(s);
                      return (
                        <Pressable
                          key={`${s.placementId ?? s.bookingId}`}
                          onPress={() => {
                            hapticSelection();
                            setDone(null);
                            setSheet({ session: s });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${sessionLabel(s)}, ${longDate(date)}${s.cancelled ? ", cancelled" : ""}`}
                        >
                          <View style={{ opacity: s.cancelled ? 0.55 : 1 }}>
                            <SessionCard
                              title={sessionLabel(s)}
                              detail={[current.dog.name, pay].filter(Boolean).join(" · ")}
                              tag={s.cancelled ? "Cancelled" : s === first ? "Next" : "Confirmed"}
                              highlight={!s.cancelled && s === first}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                    {asked.map((r) => (
                      <View key={r.id} style={{ opacity: 0.6 }}>
                        <SessionCard
                          title={requestTitle(r)}
                          detail={r.status === "offered" ? "We've suggested other days: see Profile → My requests" : "Asked for · waiting for the trainer"}
                          tag={r.status === "offered" ? "Pick a day" : "Pending"}
                        />
                      </View>
                    ))}
                  </DayGroup>
                </Appear>
              );
            })}
          </>
        )}
      </ScrollView>

      {current && (
        <SessionSheet
          visible={!!sheet}
          onClose={() => setSheet(null)}
          dog={{ id: current.dog.id, name: current.dog.name }}
          session={sheet?.session ?? null}
          sessions={current.sessions.filter((s) => s.date > today)}
          placements={current.placements}
          member={member}
          onDone={(message) => {
            setSheet(null);
            setDone(message);
            load();
          }}
        />
      )}
    </View>
  );
}
