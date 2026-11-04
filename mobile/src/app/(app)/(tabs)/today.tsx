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
import { BigButton, GroupHeading } from "@/components/trainer/cards";
import { EntryRow } from "@/components/trainer/entry-row";
import { ReorderList, type ReorderScroller } from "@/components/trainer/reorder-list";
import { CARD, Tag } from "@/components/ui";
import { EMPTY_REGISTER, getRegister, markFullDay, markOneToOne, type DayRegister, type OneToOneMark } from "@/data/attendance";
import { getRouteStops, notifyOnRoute, runOrder, saveRunOrder, setStopStatus, type RouteRun, type RouteState, type RouteStop, type StopStatus } from "@/data/route";
import { DAY_CAPACITY } from "@/data/sessions";
import { getToday, type TodayData, type TodayDog } from "@/data/today";
import { addDays, formatDay, formatMinutes, formatShortDay, formatTime, isWeekday, nextWeekday, todayISO } from "@/data/trainer-schedule";
import { chooseOne } from "@/lib/choose";
import { firstName, openDirections } from "@/lib/contact";
import { useBarInset, useBarScroll, useTopBarInset } from "@/lib/floating-bar";
import { hapticError, hapticLongPress, hapticSelection, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { animateListChange } from "@/lib/layout-animation";
import { colors, GLASS_BORDER } from "@/theme";

const EMPTY_ROUTE: RouteState = { pickup: new Map(), dropoff: new Map() };
const RUN_LABEL: Record<RouteRun, string> = { pickup: "Pick-ups", dropoff: "Drop-offs" };
const DONE_LABEL: Record<RouteRun, string> = { pickup: "Picked up", dropoff: "Dropped off" };
const ONE_TO_ONE_LABEL: Record<OneToOneMark, string> = { done: "Done", no_show: "No show" };

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
 * Today is also the register (data/attendance.ts): Picked up marks the dog
 * present; holding a stop gives Absent (the owner isn't told), and an
 * absent dog drops out of the drop-off run. 1-1s get Done / No show.
 * Below: 1-1s (with times), meet & greets (with where), the day's
 * cancellations and requests, and "Write today's reports" (write-reports:
 * a report card for each dog who came), which moves to the top once the
 * last dog's dropped off. "Today" or the next weekday; at the weekend,
 * Monday.
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
  const [register, setRegister] = useState<DayRegister>(EMPTY_REGISTER);
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
      const [today, stops, marks] = await Promise.all([getToday(day), getRouteStops(day).catch(() => EMPTY_ROUTE), getRegister(day).catch(() => EMPTY_REGISTER)]);
      if (loadingFor.current !== day) return;
      const ids = today.fullDay.map((d) => d.entry.dogId).filter((x): x is string => !!x);
      setData(today);
      setRoute(stops);
      setRegister(marks);
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
    setRegister(EMPTY_REGISTER);
    setDate(day);
  }

  const dogById = new Map((data?.fullDay ?? []).filter((d) => d.entry.dogId).map((d) => [d.entry.dogId!, d]));
  const dogs = data?.fullDay.filter((d) => d.entry.dogId) ?? [];
  const held = data?.fullDay.filter((d) => !d.entry.dogId) ?? [];
  const fullCount = data?.fullDay.length ?? 0;
  const runStops = route[run];
  const isAbsent = (dogId: string) => register.fullDay.get(dogId) === "absent";
  // An absent dog isn't dropped off: it leaves the drop-off run.
  const runIds = (r: RouteRun) => (r === "dropoff" ? orders.dropoff.filter((id) => !isAbsent(id)) : orders.pickup);
  const doneIn = (r: RouteRun) => runIds(r).filter((id) => route[r].get(id)?.status === "done").length;
  const absentDogs = dogs.filter((d) => isAbsent(d.entry.dogId!));
  const presentCount = [...register.fullDay.values()].filter((m) => m === "present").length + [...register.oneToOne.values()].filter((m) => m === "done").length;
  const dropoffs = runIds("dropoff");
  const dayDone = dogs.length > 0 && dropoffs.length > 0 && doneIn("dropoff") === dropoffs.length;

  function setMark(dogId: string, mark: "present" | "absent" | null) {
    setRegister((prev) => {
      const fullDay = new Map(prev.fullDay);
      if (mark) fullDay.set(dogId, mark);
      else fullDay.delete(dogId);
      return { ...prev, fullDay };
    });
  }

  function updateStop(r: RouteRun, stop: RouteStop) {
    setRoute((prev) => {
      const map = new Map(prev[r]);
      map.set(stop.dogId, stop);
      return { ...prev, [r]: map };
    });
  }

  async function reorder(ids: string[]) {
    const r = run;
    // The drop-off run on screen leaves absent dogs out: they keep their place at the end.
    if (r === "dropoff") ids = [...ids, ...orders.dropoff.filter((id) => !ids.includes(id))];
    setOrders((prev) => ({ ...prev, [r]: ids }));
    try {
      const saved = await saveRunOrder(date, r, ids);
      setRoute((prev) => ({ ...prev, [r]: saved }));
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save the order", err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function changeStatus(dog: TodayDog, status: StopStatus, notify: false | "first" | "again", r: RouteRun = run) {
    const dogId = dog.entry.dogId!;
    setBusy(dogId);
    try {
      const was = route[r].get(dogId)?.status;
      const stop = await setStopStatus(date, r, runIds(r), dogId, status, route[r]);
      updateStop(r, stop);
      // Picked up is the register: the dog's present (and an undo takes it back off).
      if (r === "pickup" && (status === "done" || was === "done")) {
        const mark = status === "done" ? "present" : null;
        try {
          await markFullDay(date, dogId, mark);
          setMark(dogId, mark);
        } catch (err) {
          hapticError();
          Alert.alert(status === "done" ? "Picked up, but the register didn't save" : "The register didn't update", err instanceof Error ? err.message : "Please try again.");
          return;
        }
      }
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

  async function setAbsent(dog: TodayDog, absent: boolean) {
    const dogId = dog.entry.dogId!;
    setBusy(dogId);
    try {
      await markFullDay(date, dogId, absent ? "absent" : null);
      hapticSuccess();
      animateListChange();
      setMark(dogId, absent ? "absent" : null);
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  /** Holding a stop: Absent (or back in), and the dog's page. */
  function stopMenu(dog: TodayDog) {
    const name = dog.entry.dogName || "This dog";
    const dogId = dog.entry.dogId!;
    const pickedUp = route.pickup.get(dogId)?.status === "done";
    hapticLongPress();
    chooseOne(name, isAbsent(dogId) ? "Marked absent today." : pickedUp ? "Picked up: they're on today's register." : undefined, [
      isAbsent(dogId)
        ? { text: "Not absent after all", onPress: () => setAbsent(dog, false) }
        : { text: "Mark absent", style: "destructive", onPress: () => (pickedUp ? confirmAbsent(dog) : setAbsent(dog, true)) },
      { text: `Open ${name}'s page`, onPress: () => router.push({ pathname: "/dog/[id]", params: { id: dogId } }) },
    ]);
  }

  function confirmAbsent(dog: TodayDog) {
    const name = dog.entry.dogName || "This dog";
    Alert.alert(`${name} was picked up`, "Mark them absent anyway? The pick-up goes back to waiting.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Mark absent",
        style: "destructive",
        onPress: async () => {
          await changeStatus(dog, "waiting", false, "pickup");
          await setAbsent(dog, true);
        },
      },
    ]);
  }

  function stopButton(dog: TodayDog) {
    if (isAbsent(dog.entry.dogId!)) {
      return (
        <Pressable
          onPress={() => {
            hapticWarning();
            Alert.alert(`${dog.entry.dogName || "This dog"}: not absent after all?`, "They go back on the runs.", [
              { text: "Keep", style: "cancel" },
              { text: "Undo", onPress: () => setAbsent(dog, false) },
            ]);
          }}
          disabled={busy === dog.entry.dogId}
          accessibilityRole="button"
          accessibilityLabel={`${dog.entry.dogName}: absent. Undo`}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7 }}
        >
          <Ionicons name="remove-circle" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "700" }}>Absent</Text>
        </Pressable>
      );
    }
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
    const absent = isAbsent(dogId);
    const done = status === "done" || absent;
    return (
      <View style={{ padding: 12, gap: 10, opacity: done ? 0.55 : 1 }}>
        <Pressable
          onPress={() => router.push({ pathname: "/dog/[id]", params: { id: dogId } })}
          onLongPress={() => stopMenu(dog)}
          delayLongPress={350}
          disabled={dragging}
          accessibilityRole="button"
          accessibilityLabel={`Stop ${index + 1}: ${e.dogName}${absent ? ", absent" : ""}, open`}
          accessibilityHint="Hold for more, like marking them absent."
          accessibilityActions={[{ name: "longpress", label: absent ? "Not absent after all" : "Mark absent" }]}
          onAccessibilityAction={(ev) => {
            if (ev.nativeEvent.actionName === "longpress") setAbsent(dog, !absent);
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: absent ? "rgba(225,29,51,0.16)" : done ? "rgba(34,197,94,0.18)" : status === "on_route" ? colors.accent : "rgba(245,245,242,0.08)",
            }}
          >
            {absent ? (
              <Ionicons name="remove" size={15} color={colors.danger} />
            ) : done ? (
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

  async function markOne(d: TodayDog, mark: OneToOneMark | null) {
    const id = d.entry.refId;
    setBusy(id);
    try {
      await markOneToOne(id, mark, d.entry.dogId);
      hapticSuccess();
      animateListChange();
      setRegister((prev) => {
        const oneToOne = new Map(prev.oneToOne);
        if (mark) oneToOne.set(id, mark);
        else oneToOne.delete(id);
        return { ...prev, oneToOne };
      });
    } catch (err) {
      hapticError();
      Alert.alert("That didn't go through", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  /** A 1-1's register: Done / No show, or what it was marked (tap to change). */
  function oneToOneButtons(d: TodayDog) {
    const id = d.entry.refId;
    const mark = register.oneToOne.get(id);
    if (busy === id) return <ActivityIndicator size="small" color={colors.muted} style={{ alignSelf: "flex-start" }} />;
    if (mark) {
      const tone = mark === "done" ? colors.success : colors.danger;
      return (
        <Pressable
          onPress={() =>
            chooseOne(`${d.entry.dogName || d.entry.holderName || "This 1-1"}: ${ONE_TO_ONE_LABEL[mark].toLowerCase()}`, undefined, [
              { text: mark === "done" ? "It was a no show" : "It went ahead", onPress: () => markOne(d, mark === "done" ? "no_show" : "done") },
              { text: "Clear", onPress: () => markOne(d, null) },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel={`${ONE_TO_ONE_LABEL[mark]}. Change`}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" }}
        >
          <Ionicons name={mark === "done" ? "checkmark-circle" : "close-circle"} size={18} color={tone} />
          <Text style={{ color: tone, fontSize: 13, fontWeight: "700" }}>{ONE_TO_ONE_LABEL[mark]}</Text>
        </Pressable>
      );
    }
    const pill = (m: OneToOneMark, icon: "checkmark" | "close") => (
      <Pressable
        key={m}
        onPress={() => markOne(d, m)}
        accessibilityRole="button"
        style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: m === "done" ? 0 : 1, borderColor: colors.border, backgroundColor: m === "done" ? colors.accent : "transparent" }}
      >
        <Ionicons name={icon} size={15} color={m === "done" ? colors.accentForeground : colors.foreground} />
        <Text style={{ color: m === "done" ? colors.accentForeground : colors.foreground, fontSize: 13, fontWeight: "700" }}>{ONE_TO_ONE_LABEL[m]}</Text>
      </Pressable>
    );
    return <View style={{ flexDirection: "row", gap: 8 }}>{[pill("done", "checkmark"), pill("no_show", "close")]}</View>;
  }

  // End of the day: a report card for each dog who came. Solid, at the top, once the last dog's dropped off.
  const reportsButton = (
    <View style={{ marginTop: dayDone ? 0 : 20 }}>
      <BigButton
        icon="document-text-outline"
        label="Write today's reports"
        variant={dayDone ? "solid" : "outline"}
        onPress={() => router.push({ pathname: "/write-reports", params: { date } })}
      />
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 8 }}>
        {presentCount ? `${presentCount} dog${presentCount === 1 ? "" : "s"} on today's register` : "For each dog marked picked up (or a 1-1 done)"}
      </Text>
    </View>
  );

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

        {data && isToday && dayDone && <View style={{ marginTop: 14 }}>{reportsButton}</View>}

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
                          options={(["pickup", "dropoff"] as RouteRun[]).map((r) => ({ value: r, label: RUN_LABEL[r], note: `${doneIn(r)}/${runIds(r).filter((id) => !isAbsent(id)).length}` }))}
                          value={run}
                          onChange={(r) => {
                            animateListChange();
                            setRun(r);
                          }}
                        />
                        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10, marginBottom: 10 }}>
                          {run === "dropoff" && route.dropoff.size === 0 ? "Same order as the pick-ups until you change it. " : ""}Drag ≡ to change the order. Hold a dog to mark it absent.
                        </Text>
                        <ReorderList
                          key={`${date}-${run}`}
                          ids={runIds(run)}
                          renderRow={renderStop}
                          onReorder={reorder}
                          onDragChange={setDragging}
                          scroller={scroller}
                          labelFor={(id) => dogById.get(id)?.entry.dogName ?? "dog"}
                        />
                        {run === "dropoff" && absentDogs.length > 0 && (
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
                            Absent today: {absentDogs.map((d) => d.entry.dogName).join(", ")}. Hold them on Pick-ups to undo.
                          </Text>
                        )}
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
                      {(d.unpaid || d.medical || d.address || d.durationMin) && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingBottom: 10, marginTop: -4, paddingLeft: 52 }}>
                          {!!d.durationMin && <Tag label={formatMinutes(d.durationMin)} />}
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
                      {date <= today && <View style={{ paddingBottom: 12, paddingLeft: 52 }}>{oneToOneButtons(d)}</View>}
                    </View>
                  ))}
                </View>
              </>
            )}

            {data.meetGreets.length > 0 && (
              <>
                <GroupHeading>Meet & greets</GroupHeading>
                <View style={[CARD, { paddingVertical: 4 }]}>
                  {data.meetGreets.map((m, i) => (
                    <View key={m.entry.refId}>
                      <EntryRow entry={m.entry} first={i === 0} onPress={() => router.push({ pathname: "/onboarding/[id]", params: { id: m.entry.refId } })} />
                      {m.address && (
                        <Pressable
                          onPress={() => openDirections(m.address!)}
                          hitSlop={4}
                          accessibilityRole="button"
                          accessibilityLabel={`Directions to ${m.address}`}
                          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 12, marginTop: -4, paddingLeft: 52 }}
                        >
                          <Ionicons name="navigate-outline" size={13} color={colors.muted} />
                          <Text style={{ color: colors.muted, fontSize: 12, textDecorationLine: "underline", flex: 1 }} numberOfLines={2}>
                            {m.address}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              </>
            )}

            {isToday && !dayDone && reportsButton}

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
