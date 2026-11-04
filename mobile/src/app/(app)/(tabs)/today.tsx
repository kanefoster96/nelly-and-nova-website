import { Ionicons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { Appear } from "@/components/appear";
import { AvatarCircle } from "@/components/avatar-circle";
import { PageTitle } from "@/components/page-title";
import { Pressable } from "@/components/pressable";
import { RefreshControl } from "@/components/refresh-control";
import { GroupHeading } from "@/components/trainer/cards";
import { EntryRow } from "@/components/trainer/entry-row";
import { ReorderList, type ReorderScroller } from "@/components/trainer/reorder-list";
import { CARD, Tag } from "@/components/ui";
import { getRouteStops, notifyOnRoute, runOrder, saveRunOrder, setStopStatus, type RouteRun, type RouteState, type RouteStop, type StopStatus } from "@/data/route";
import { DAY_CAPACITY } from "@/data/sessions";
import { getToday, type TodayData, type TodayDog } from "@/data/today";
import { addDays, formatDay, formatShortDay, formatTime, isWeekday, nextWeekday, todayISO } from "@/data/trainer-schedule";
import { firstName, openDirections } from "@/lib/contact";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticError, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

const EMPTY_ROUTE: RouteState = { pickup: new Map(), dropoff: new Map() };
const RUN_LABEL: Record<RouteRun, string> = { pickup: "Pick-ups", dropoff: "Drop-offs" };
const DONE_LABEL: Record<RouteRun, string> = { pickup: "Picked up", dropoff: "Dropped off" };

function timeOf(iso: string): string {
  const d = new Date(iso);
  return formatTime(`${d.getHours()}:${d.getMinutes()}`);
}

/** Two pills side by side: the day, or the run. */
function Segments<T extends string>({ options, value, onChange }: { options: { value: T; label: string; note?: string }[]; value: T; onChange: (v: T) => void }) {
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
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, paddingVertical: 9, borderRadius: 999, backgroundColor: on ? colors.accent : "transparent" }}
          >
            <Text style={{ color: on ? colors.accentForeground : colors.foreground, fontSize: 14, fontWeight: "700" }}>{o.label}</Text>
            {!!o.note && <Text style={{ color: on ? colors.accentForeground : colors.muted, fontSize: 12, fontWeight: "600", opacity: 0.75 }}>{o.note}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The flags on a dog's row: anything to notice before it gets in the van. */
function Flags({ dog }: { dog: TodayDog }) {
  const e = dog.entry;
  const tags: { label: string; tone: string }[] = [];
  if (e.dogId && !e.registered) tags.push({ label: "Not registered", tone: colors.warning });
  if (dog.medical) tags.push({ label: "Medical", tone: colors.danger });
  if (dog.unpaid) tags.push({ label: "Unpaid", tone: colors.warning });
  if (e.kind === "full_day_one_off") tags.push({ label: "One-off", tone: "#0ea5e9" });
  if (dog.request) tags.push({ label: dog.request.status === "offered" ? "Offer out" : "Request", tone: colors.warning });
  if (tags.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {tags.map((t) => (
        <Tag key={t.label} label={t.label} tone={t.tone} />
      ))}
    </View>
  );
}

/**
 * Trainer: Today — the day's dogs, as Kanvas's coach sees the day's
 * classes. The date and how many are in, then the Full Day dogs as the
 * day's two runs, Pick-ups and Drop-offs: numbered stops, put in order by
 * dragging the ≡ handle (saved per date and run), each with its address
 * (tap for directions), its flags (not registered, unpaid, medical, a
 * request) and the next step: On route tells the owner we're on our way,
 * then Picked up / Dropped off ticks it off. A tap on a dog opens its page.
 * Below: 1-1s (with times), meet & greets, the day's cancellations and
 * requests. "Today" or the next weekday; at the weekend, Monday.
 */
export default function TodayScreen() {
  const { isTrainer } = useAuth();
  const router = useRouter();
  const barInset = useBarInset();
  const barScroll = useBarScroll();
  const topInset = useTopBarInset();
  const { height: windowHeight } = useWindowDimensions();

  const today = todayISO();
  const next = nextWeekday(addDays(today, 1));
  const weekend = !isWeekday(today);
  const [date, setDate] = useState(weekend ? next : today);
  const [data, setData] = useState<TodayData | null>(null);
  const [route, setRoute] = useState<RouteState>(EMPTY_ROUTE);
  const [orders, setOrders] = useState<Record<RouteRun, string[]>>({ pickup: [], dropoff: [] });
  const [run, setRun] = useState<RouteRun>("pickup");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const loadingFor = useRef(date);

  // The page's scroll, for dragging a stop near the top or bottom edge.
  const scrollNode = useRef<ScrollView | null>(null);
  const scrollY = useRef(0);
  const contentH = useRef(0);
  const viewH = useRef(0);
  const scroller: ReorderScroller = {
    scrollBy: (dy) => {
      const max = Math.max(0, contentH.current - viewH.current);
      const to = Math.min(max, Math.max(0, scrollY.current + dy));
      const moved = to - scrollY.current;
      if (moved) {
        scrollY.current = to;
        scrollNode.current?.scrollTo({ y: to, animated: false });
      }
      return moved;
    },
    visible: () => ({ top: topInset, bottom: windowHeight - barInset }),
  };

  const load = useCallback(async (day: string) => {
    loadingFor.current = day;
    setError(null);
    try {
      const [today, stops] = await Promise.all([getToday(day), getRouteStops(day).catch(() => EMPTY_ROUTE)]);
      if (loadingFor.current !== day) return;
      const ids = today.fullDay.map((d) => d.entry.dogId).filter((x): x is string => !!x);
      setData(today);
      setRoute(stops);
      setOrders({ pickup: runOrder("pickup", ids, stops), dropoff: runOrder("dropoff", ids, stops) });
    } catch (err) {
      if (loadingFor.current === day) setError(err instanceof Error ? err.message : "Couldn't load the day.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isTrainer) load(date);
    }, [isTrainer, load, date]),
  );

  if (!isTrainer) return <Redirect href="/community" />;

  function chooseDate(day: string) {
    setData(null);
    setDate(day);
  }

  const dogById = new Map((data?.fullDay ?? []).filter((d) => d.entry.dogId).map((d) => [d.entry.dogId!, d]));
  const dogs = data?.fullDay.filter((d) => d.entry.dogId) ?? [];
  const held = data?.fullDay.filter((d) => !d.entry.dogId) ?? [];
  const fullCount = data?.fullDay.length ?? 0;
  const runStops = route[run];
  const doneIn = (r: RouteRun) => orders[r].filter((id) => route[r].get(id)?.status === "done").length;

  function updateStop(r: RouteRun, stop: RouteStop) {
    setRoute((prev) => {
      const map = new Map(prev[r]);
      map.set(stop.dogId, stop);
      return { ...prev, [r]: map };
    });
  }

  async function reorder(ids: string[]) {
    const r = run;
    setOrders((prev) => ({ ...prev, [r]: ids }));
    try {
      const saved = await saveRunOrder(date, r, ids);
      setRoute((prev) => ({ ...prev, [r]: saved }));
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save the order", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function changeStatus(dog: TodayDog, status: StopStatus, notify: false | "first" | "again") {
    const dogId = dog.entry.dogId!;
    const r = run;
    setBusy(dogId);
    try {
      const stop = await setStopStatus(date, r, orders[r], dogId, status, route[r]);
      updateStop(r, stop);
      if (notify && dog.entry.accountId) {
        try {
          const res = await notifyOnRoute(stop.id, notify === "again");
          updateStop(r, { ...stop, notifiedAt: stop.notifiedAt ?? new Date().toISOString() });
          hapticSuccess();
          if (res.alreadySent) Alert.alert("Already sent", `${firstName(dog.ownerName) || "They"} had already been told.`);
        } catch (err) {
          hapticError();
          Alert.alert("Marked on route, but the message didn't go", err instanceof Error ? err.message : "Please try again.");
        }
      } else {
        hapticSuccess();
      }
      animateListChange();
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function onRoute(dog: TodayDog) {
    const name = dog.entry.dogName || "their dog";
    const owner = firstName(dog.ownerName) || "the owner";
    const stop = runStops.get(dog.entry.dogId!);
    hapticWarning();
    if (!dog.entry.accountId) {
      Alert.alert(`Mark ${name} on route?`, "There's no owner on file to let know.", [
        { text: "Cancel", style: "cancel" },
        { text: "Mark on route", onPress: () => changeStatus(dog, "on_route", false) },
      ]);
      return;
    }
    if (stop?.notifiedAt) {
      Alert.alert("Send again?", `${owner} was told at ${timeOf(stop.notifiedAt)} that you were on your way.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Just mark on route", onPress: () => changeStatus(dog, "on_route", false) },
        { text: "Send again", onPress: () => changeStatus(dog, "on_route", "again") },
      ]);
      return;
    }
    Alert.alert(
      run === "pickup" ? `Let ${owner} know you're on your way to collect ${name}?` : `Let ${owner} know ${name} is on the way home?`,
      "They'll get a notification on their phone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Let them know", onPress: () => changeStatus(dog, "on_route", "first") },
      ],
    );
  }

  function undo(dog: TodayDog) {
    const name = dog.entry.dogName || "This dog";
    hapticWarning();
    Alert.alert(`${name}: not ${DONE_LABEL[run].toLowerCase()} yet?`, "The stop goes back to waiting.", [
      { text: "Keep", style: "cancel" },
      { text: "Undo", onPress: () => changeStatus(dog, "waiting", false) },
    ]);
  }

  function stopButton(dog: TodayDog) {
    const status = runStops.get(dog.entry.dogId!)?.status ?? "waiting";
    const working = busy === dog.entry.dogId;
    if (status === "done") {
      return (
        <Pressable
          onPress={() => undo(dog)}
          accessibilityRole="button"
          accessibilityLabel={`${dog.entry.dogName}: ${DONE_LABEL[run]}. Undo`}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7 }}
        >
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: 13, fontWeight: "700" }}>{DONE_LABEL[run]}</Text>
        </Pressable>
      );
    }
    const onRouteNow = status === "on_route";
    return (
      <Pressable
        onPress={() => (onRouteNow ? changeStatus(dog, "done", false) : onRoute(dog))}
        disabled={working || dragging}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: onRouteNow ? colors.accent : "transparent",
          borderWidth: onRouteNow ? 0 : 1,
          borderColor: colors.border,
        }}
      >
        {working ? (
          <ActivityIndicator size="small" color={onRouteNow ? colors.accentForeground : colors.foreground} />
        ) : (
          <Ionicons name={onRouteNow ? "checkmark" : "car-outline"} size={15} color={onRouteNow ? colors.accentForeground : colors.foreground} />
        )}
        <Text style={{ color: onRouteNow ? colors.accentForeground : colors.foreground, fontSize: 13, fontWeight: "700" }}>{onRouteNow ? DONE_LABEL[run] : "On route"}</Text>
      </Pressable>
    );
  }

  function renderStop(dogId: string, index: number) {
    const dog = dogById.get(dogId);
    if (!dog) return null;
    const e = dog.entry;
    const status = runStops.get(dogId)?.status ?? "waiting";
    const done = status === "done";
    return (
      <View style={{ padding: 12, gap: 10, opacity: done ? 0.55 : 1 }}>
        <Pressable
          onPress={() => router.push({ pathname: "/dog/[id]", params: { id: dogId } })}
          disabled={dragging}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${index + 1}: ${e.dogName}, open`}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: done ? "rgba(34,197,94,0.18)" : status === "on_route" ? colors.accent : "rgba(245,245,242,0.08)",
            }}
          >
            {done ? (
              <Ionicons name="checkmark" size={15} color={colors.success} />
            ) : (
              <Text style={{ color: status === "on_route" ? colors.accentForeground : colors.foreground, fontSize: 13, fontWeight: "800" }}>{index + 1}</Text>
            )}
          </View>
          <AvatarCircle name={e.dogName || "Dog"} avatarUrl={e.dogPhoto} size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }} numberOfLines={1}>
              {e.dogName}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
              {[dog.breed, dog.ownerName].filter(Boolean).join(" · ") || "Owner not on file"}
            </Text>
          </View>
        </Pressable>
        <Flags dog={dog} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {dog.address ? (
            <Pressable
              onPress={() => openDirections(dog.address!)}
              disabled={dragging}
              accessibilityRole="button"
              accessibilityLabel={`Directions to ${dog.address}`}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}
            >
              <Ionicons name="navigate-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, textDecorationLine: "underline" }} numberOfLines={2}>
                {dog.address}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>No address on file</Text>
          )}
          {stopButton(dog)}
        </View>
      </View>
    );
  }

  const isToday = date === today;
  const dayOptions = [
    { value: today, label: "Today" },
    { value: next, label: next === addDays(today, 1) ? "Tomorrow" : formatShortDay(next) },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        ref={(node) => {
          scrollNode.current = node;
          barScroll.ref(node);
        }}
        onScroll={(ev) => {
          scrollY.current = ev.nativeEvent.contentOffset.y;
          barScroll.onScroll(ev);
        }}
        scrollEventThrottle={16}
        scrollEnabled={!dragging}
        onLayout={(ev) => (viewH.current = ev.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => (contentH.current = h)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 8, paddingBottom: barInset }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(date);
              setRefreshing(false);
            }}
            tintColor={colors.foreground}
          />
        }
      >
        <PageTitle
          title={isToday ? "Today" : date === addDays(today, 1) ? "Tomorrow" : formatShortDay(date)}
          note={data && isWeekday(date) ? `${fullCount}/${DAY_CAPACITY} dogs` : null}
          noteColor={fullCount >= DAY_CAPACITY ? colors.danger : colors.success}
          subtitle={formatDay(date)}
          style={{ marginBottom: 14 }}
        />

        <Segments options={dayOptions} value={date} onChange={chooseDate} />

        {weekend && !isToday && (
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 14 }}>It&apos;s the weekend, so here&apos;s who&apos;s in on {formatDay(date)}.</Text>
        )}

        {error && <Text style={{ color: colors.danger, marginTop: 14 }}>{error}</Text>}

        {!data ? (
          <ActivityIndicator color={colors.foreground} style={{ marginTop: 40 }} />
        ) : (
          <>
            {!isWeekday(date) ? (
              <Appear index={0} style={[CARD, { marginTop: 20, alignItems: "center", paddingVertical: 28 }]}>
                <Ionicons name="sunny-outline" size={30} color={colors.warning} />
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700", marginTop: 10 }}>No Full Day Training at the weekend</Text>
                <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4, textAlign: "center", lineHeight: 20 }}>Enjoy the break! Tap {dayOptions[1].label} to see who&apos;s in next.</Text>
              </Appear>
            ) : (
              <>
                <GroupHeading>Full Day Training</GroupHeading>
                {dogs.length === 0 && held.length === 0 ? (
                  <View style={[CARD, { alignItems: "center", paddingVertical: 24 }]}>
                    <Text style={{ color: colors.muted, fontSize: 14 }}>No dogs booked in.</Text>
                  </View>
                ) : (
                  <>
                    {dogs.length > 0 && (
                      <>
                        <Segments
                          options={(["pickup", "dropoff"] as RouteRun[]).map((r) => ({ value: r, label: RUN_LABEL[r], note: `${doneIn(r)}/${orders[r].length}` }))}
                          value={run}
                          onChange={(r) => {
                            animateListChange();
                            setRun(r);
                          }}
                        />
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10, marginBottom: 10 }}>
                          {run === "dropoff" && route.dropoff.size === 0 ? "Same order as the pick-ups until you change it. " : ""}Drag ≡ to change the order.
                        </Text>
                        <ReorderList
                          key={`${date}-${run}`}
                          ids={orders[run]}
                          renderRow={renderStop}
                          onReorder={reorder}
                          onDragChange={setDragging}
                          scroller={scroller}
                          labelFor={(id) => dogById.get(id)?.entry.dogName ?? "dog"}
                        />
                      </>
                    )}
                    {held.length > 0 && (
                      <View style={[CARD, { paddingVertical: 4, marginTop: 10 }]}>
                        {held.map((d, i) => (
                          <EntryRow key={d.entry.refId} entry={d.entry} first={i === 0} />
                        ))}
                      </View>
                    )}
                  </>
                )}
              </>
            )}

            {data.oneToOnes.length > 0 && (
              <>
                <GroupHeading>1-1s</GroupHeading>
                <View style={[CARD, { paddingVertical: 4 }]}>
                  {data.oneToOnes.map((d, i) => (
                    <View key={d.entry.refId}>
                      <EntryRow entry={d.entry} first={i === 0} onPress={d.entry.dogId ? () => router.push({ pathname: "/dog/[id]", params: { id: d.entry.dogId! } }) : undefined} />
                      {(d.unpaid || d.medical || d.address) && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingBottom: 10, marginTop: -4, paddingLeft: 52 }}>
                          {d.unpaid && <Tag label="Unpaid" tone={colors.warning} />}
                          {d.medical && <Tag label="Medical" tone={colors.danger} />}
                          {d.address && (
                            <Pressable onPress={() => openDirections(d.address!)} hitSlop={4} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Ionicons name="navigate-outline" size={13} color={colors.muted} />
                              <Text style={{ color: colors.muted, fontSize: 12, textDecorationLine: "underline" }} numberOfLines={1}>
                                {d.address}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {data.meetGreets.length > 0 && (
              <>
                <GroupHeading>Meet & greets</GroupHeading>
                <View style={[CARD, { paddingVertical: 4 }]}>
                  {data.meetGreets.map((e, i) => (
                    <EntryRow key={e.refId} entry={e} first={i === 0} onPress={() => router.push({ pathname: "/onboarding/[id]", params: { id: e.refId } })} />
                  ))}
                </View>
              </>
            )}

            {(data.cancellations.length > 0 || data.otherRequests.length > 0) && (
              <>
                <GroupHeading>Changes</GroupHeading>
                <View style={[CARD, { paddingVertical: 4 }]}>
                  {data.cancellations.map((c, i) => (
                    <View key={`c${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                      <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                      <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>
                        {c.dogName}
                        <Text style={{ color: colors.muted }}> · cancelled{c.reason ? ` · ${c.reason}` : ""}</Text>
                      </Text>
                    </View>
                  ))}
                  {data.otherRequests.map((r, i) => (
                    <Pressable
                      key={r.id}
                      onPress={() => router.push({ pathname: "/requests/[id]", params: { id: r.id } })}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i === 0 && data.cancellations.length === 0 ? 0 : 1, borderTopColor: colors.border }}
                    >
                      <Ionicons name="time-outline" size={18} color={colors.warning} />
                      <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }} numberOfLines={1}>
                        {r.dogName}
                        <Text style={{ color: colors.muted }}> · {r.status === "offered" ? "offered this day" : "asked for this day"}</Text>
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    </Pressable>
                  ))}
                </View>
                {data.cancellations.length > 0 && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Don&apos;t collect cancelled dogs.</Text>}
              </>
            )}

            <Pressable
              onPress={() => router.push({ pathname: "/day/[date]", params: { date } })}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20, paddingVertical: 12 }}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Open day · add or remove dogs</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.muted} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}
