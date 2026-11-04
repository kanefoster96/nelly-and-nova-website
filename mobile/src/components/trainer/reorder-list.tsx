import { Ionicons } from "@expo/vector-icons";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, View, type LayoutChangeEvent } from "react-native";

import { hapticLongPress, hapticSelection, hapticTap } from "@/lib/haptics";
import { colors, GLASS_BORDER } from "@/theme";

/**
 * A list you put in order by dragging a row by its ≡ handle — the day's
 * pick-up and drop-off runs on Today. Built from React Native's own
 * PanResponder and Animated (no gesture library, so it ships over the
 * air): the row lifts with a shadow and follows the finger, the others
 * slide out of its way, and near the top or bottom of the screen the page
 * scrolls along. A tick when it lifts, a tick each time it passes a row, a
 * tap when it drops. Screen readers get Move up / Move down on each handle.
 */

const GAP = 8;
/** How close to the screen's edge (points) the finger must be to scroll the page, and how fast. */
const EDGE = 80;
const SPEED = 9;

export type ReorderScroller = {
  /** Scroll the page by `dy` (clamped); returns how far it actually moved. */
  scrollBy: (dy: number) => number;
  /** The visible band of the page, in screen coordinates. */
  visible: () => { top: number; bottom: number };
};

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type Drag = { id: string; start: number; target: number; dy: number; scrolled: number; moveY: number };

export function ReorderList({
  ids,
  renderRow,
  onReorder,
  onDragChange,
  scroller,
  labelFor,
  disabled = false,
}: {
  ids: string[];
  /** A row's content, beside its handle (the row draws the card around both). */
  renderRow: (id: string, index: number) => ReactNode;
  onReorder: (ids: string[]) => void;
  /** Dragging started or stopped: the page shouldn't scroll under the finger meanwhile. */
  onDragChange?: (dragging: boolean) => void;
  scroller?: ReorderScroller;
  /** "Bella" — for the handle's label. */
  labelFor: (id: string) => string;
  disabled?: boolean;
}) {
  const layouts = useRef(new Map<string, { y: number; h: number }>()).current;
  const shifts = useRef(new Map<string, Animated.Value>()).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;
  const drag = useRef<Drag | null>(null);
  const pendingReset = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [active, setActive] = useState<string | null>(null);

  // The latest props, for the responders made once per row.
  const latest = useRef({ ids, onReorder, onDragChange, scroller });
  latest.current = { ids, onReorder, onDragChange, scroller };

  const shiftOf = (id: string) => {
    let v = shifts.get(id);
    if (!v) {
      v = new Animated.Value(0);
      shifts.set(id, v);
    }
    return v;
  };

  // A new order has landed: put every row back where its layout now is, before the frame's drawn.
  useLayoutEffect(() => {
    if (!pendingReset.current) return;
    pendingReset.current = false;
    dragY.setValue(0);
    lift.setValue(0);
    for (const v of shifts.values()) v.setValue(0);
    setActive(null);
  }, [ids, dragY, lift, shifts]);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  function targetFor(d: Drag): number {
    const me = layouts.get(d.id);
    if (!me) return d.start;
    const centre = me.y + me.h / 2 + d.dy + d.scrolled;
    let target = 0;
    for (const id of latest.current.ids) {
      if (id === d.id) continue;
      const l = layouts.get(id);
      if (l && l.y + l.h / 2 < centre) target++;
    }
    return target;
  }

  function update() {
    const d = drag.current;
    if (!d) return;
    dragY.setValue(d.dy + d.scrolled);
    const target = targetFor(d);
    if (target === d.target) return;
    d.target = target;
    hapticSelection();
    const size = (layouts.get(d.id)?.h ?? 0) + GAP;
    latest.current.ids.forEach((id, i) => {
      if (id === d.id) return;
      let to = 0;
      if (d.start < target && i > d.start && i <= target) to = -size;
      else if (target < d.start && i >= target && i < d.start) to = size;
      Animated.spring(shiftOf(id), { toValue: to, useNativeDriver: false, speed: 24, bounciness: 4 }).start();
    });
  }

  function tick() {
    const d = drag.current;
    const s = latest.current.scroller;
    if (!d || !s) return;
    const { top, bottom } = s.visible();
    let dy = 0;
    if (d.moveY < top + EDGE) dy = -SPEED * Math.min(1, (top + EDGE - d.moveY) / EDGE);
    else if (d.moveY > bottom - EDGE) dy = SPEED * Math.min(1, (d.moveY - (bottom - EDGE)) / EDGE);
    if (!dy) return;
    const moved = s.scrollBy(dy);
    if (!moved) return;
    d.scrolled += moved;
    update();
  }

  function begin(id: string, pageY: number) {
    const start = latest.current.ids.indexOf(id);
    if (start < 0) return;
    hapticLongPress();
    drag.current = { id, start, target: start, dy: 0, scrolled: 0, moveY: pageY };
    setActive(id);
    latest.current.onDragChange?.(true);
    Animated.spring(lift, { toValue: 1, useNativeDriver: false, speed: 30, bounciness: 6 }).start();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(tick, 16);
  }

  function moveTo(dy: number, moveY: number) {
    const d = drag.current;
    if (!d) return;
    d.dy = dy;
    d.moveY = moveY;
    update();
  }

  function end() {
    const d = drag.current;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    drag.current = null;
    latest.current.onDragChange?.(false);
    if (!d) return;
    hapticTap();
    const list = latest.current.ids;
    let offset = 0;
    if (d.target > d.start) for (let i = d.start + 1; i <= d.target; i++) offset += (layouts.get(list[i])?.h ?? 0) + GAP;
    else for (let i = d.target; i < d.start; i++) offset -= (layouts.get(list[i])?.h ?? 0) + GAP;
    Animated.parallel([
      Animated.spring(dragY, { toValue: offset, useNativeDriver: false, speed: 28, bounciness: 3 }),
      Animated.timing(lift, { toValue: 0, duration: 140, useNativeDriver: false }),
    ]).start(() => {
      if (d.target === d.start) {
        dragY.setValue(0);
        setActive(null);
        return;
      }
      pendingReset.current = true;
      latest.current.onReorder(move(list, d.start, d.target));
    });
  }

  const handlers = useRef({ begin, moveTo, end });
  handlers.current = { begin, moveTo, end };

  function step(id: string, by: -1 | 1) {
    const i = ids.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= ids.length) return;
    hapticSelection();
    onReorder(move(ids, i, j));
  }

  return (
    <View style={{ gap: GAP }}>
      {ids.map((id, index) => {
        const dragging = active === id;
        const scale = dragging ? lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) : 1;
        return (
          <Animated.View
            key={id}
            onLayout={(e: LayoutChangeEvent) => layouts.set(id, { y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
            style={{
              zIndex: dragging ? 10 : 0,
              elevation: dragging ? 8 : 0,
              transform: [{ translateY: dragging ? dragY : shiftOf(id) }, { scale }],
              boxShadow: dragging ? "0 12px 28px rgba(0,0,0,0.55)" : undefined,
              borderRadius: 18,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "stretch", borderWidth: 1, ...GLASS_BORDER, backgroundColor: colors.surface, borderRadius: 18, overflow: "hidden" }}>
              <View style={{ flex: 1, minWidth: 0 }}>{renderRow(id, index)}</View>
              {!disabled && (
                <Handle
                  label={`Reorder ${labelFor(id)}, stop ${index + 1} of ${ids.length}`}
                  handlers={handlers}
                  id={id}
                  onStep={(by) => step(id, by)}
                />
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function Handle({
  id,
  label,
  handlers,
  onStep,
}: {
  id: string;
  label: string;
  handlers: React.RefObject<{ begin: (id: string, pageY: number) => void; moveTo: (dy: number, moveY: number) => void; end: () => void }>;
  onStep: (by: -1 | 1) => void;
}) {
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Once a row's lifted, the page doesn't get to take the gesture back.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => handlers.current?.begin(id, e.nativeEvent.pageY),
      onPanResponderMove: (_e, g) => handlers.current?.moveTo(g.dy, g.moveY),
      onPanResponderRelease: () => handlers.current?.end(),
      onPanResponderTerminate: () => handlers.current?.end(),
    }),
  ).current;
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Drag to change the order, or swipe up or down."
      accessibilityActions={[
        { name: "increment", label: "Move down" },
        { name: "decrement", label: "Move up" },
        { name: "moveUp", label: "Move up" },
        { name: "moveDown", label: "Move down" },
      ]}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === "moveUp" || name === "decrement") onStep(-1);
        if (name === "moveDown" || name === "increment") onStep(1);
      }}
      hitSlop={6}
      style={{ width: 40, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: colors.border }}
    >
      <Ionicons name="reorder-three" size={26} color={colors.muted} />
    </View>
  );
}
