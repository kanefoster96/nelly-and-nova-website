import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The floating glass bar along the bottom of the tabs
 * (components/floating-bar.tsx) and the floating top buttons
 * (components/top-bar.tsx), as in the Kanvas app (its
 * contexts/floating-bar.tsx, minus the checkout button). Tab pages talk to
 * them through the hooks here:
 *
 * - useBarScroll: the bar shrinks while the page scrolls down, the top
 *   buttons ride up and fade, and tapping the tab the page is on takes it
 *   back to the top.
 * - useBarInset / useTopBarInset: room so nothing ends up under either.
 */

/** The bar's height, and its gap from the bottom edge. */
export const BAR_HEIGHT = 64;
export function useBarBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom - 6, 12);
}

/** A ScrollView or FlatList the bar can take back to the top. */
type Scrollable = {
  scrollTo?: (options: { y: number; animated: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated: boolean }) => void;
};

/**
 * How far the floating top buttons have moved up off the screen, in
 * points: they ride up with the page as it scrolls down, fading as they
 * go, and slide back in on a quick swipe up.
 */
export const TOP_BAR_TRAVEL = 140;

type Setters = {
  header: Animated.Value;
  headerScroll: (y: number, dy: number) => void;
  showHeader: () => void;
  collapse: Animated.Value;
  setCollapsed: (collapsed: boolean) => void;
  setScroller: (id: string, node: Scrollable | null) => void;
  focusScroller: (id: string, focused: boolean) => void;
  scrollToTop: () => void;
};

const SettersContext = createContext<Setters | null>(null);

export function FloatingBarProvider({ children }: { children: ReactNode }) {
  const collapse = useRef(new Animated.Value(0)).current;
  const collapsedRef = useRef(false);
  // The top buttons' offset: followed point for point on the way down (so
  // they stay where they were on the page), sprung back to 0 on a quick
  // swipe up or near the top.
  const header = useRef(new Animated.Value(0)).current;
  const headerAt = useRef(0);
  const headerSpringing = useRef(false);
  // Pages' main lists, and which pages are on screen (most recent last).
  const scrollers = useRef(new Map<string, Scrollable>()).current;
  const scrollerFocus = useRef<string[]>([]).current;

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      if (collapsedRef.current === collapsed) return;
      collapsedRef.current = collapsed;
      Animated.spring(collapse, { toValue: collapsed ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
    },
    [collapse]
  );

  const showHeader = useCallback(() => {
    if (headerAt.current === 0 && !headerSpringing.current) return;
    headerAt.current = 0;
    headerSpringing.current = true;
    Animated.spring(header, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 3 }).start(() => {
      headerSpringing.current = false;
    });
  }, [header]);

  const headerScroll = useCallback(
    (y: number, dy: number) => {
      // At (or pulled past) the top: where the page puts them.
      if (y <= 0) {
        if (headerAt.current !== 0) showHeader();
        return;
      }
      if (dy > 0) {
        // Down: they ride up with the page and fade.
        if (headerAt.current >= TOP_BAR_TRAVEL) return;
        header.stopAnimation();
        headerSpringing.current = false;
        headerAt.current = Math.min(TOP_BAR_TRAVEL, headerAt.current + dy);
        header.setValue(headerAt.current);
      } else if (dy < -14) {
        // A quick swipe up: they slide back in.
        showHeader();
      } else if (headerAt.current > y) {
        // Slowly back up to the top: they come down with the page.
        header.stopAnimation();
        headerSpringing.current = false;
        headerAt.current = Math.max(0, y);
        header.setValue(headerAt.current);
      }
    },
    [header, showHeader]
  );

  const setters = useMemo<Setters>(
    () => ({
      header,
      headerScroll,
      showHeader,
      collapse,
      setCollapsed,
      setScroller: (id, node) => {
        if (node) scrollers.set(id, node);
        else scrollers.delete(id);
      },
      focusScroller: (id, focused) => {
        const at = scrollerFocus.indexOf(id);
        if (at >= 0) scrollerFocus.splice(at, 1);
        if (focused) scrollerFocus.push(id);
      },
      // The page on screen, back to the top (its list's start: the newest
      // messages in a chat, which runs from the bottom).
      scrollToTop: () => {
        for (let i = scrollerFocus.length - 1; i >= 0; i--) {
          const node = scrollers.get(scrollerFocus[i]);
          if (!node) continue;
          if (node.scrollToOffset) node.scrollToOffset({ offset: 0, animated: true });
          else node.scrollTo?.({ y: 0, animated: true });
          setCollapsed(false);
          showHeader();
          return;
        }
      },
    }),
    [collapse, setCollapsed, scrollers, scrollerFocus, header, headerScroll, showHeader]
  );

  return <SettersContext.Provider value={setters}>{children}</SettersContext.Provider>;
}

/** For the bar itself. */
export function useFloatingBarState(): { collapse: Animated.Value; setCollapsed: (c: boolean) => void; scrollToTop: () => void } {
  const setters = useContext(SettersContext);
  const fallback = useRef(new Animated.Value(0)).current;
  return {
    collapse: setters?.collapse ?? fallback,
    setCollapsed: setters?.setCollapsed ?? (() => {}),
    scrollToTop: setters?.scrollToTop ?? (() => {}),
  };
}

/** Room to leave at the bottom of a page the bar sits over. */
export function useBarInset(): number {
  return BAR_HEIGHT + useBarBottom() + 16;
}

/**
 * A list the bar can take back to the top while its page is on screen,
 * when the tab it's on is tapped again. Give the result to the list's ref.
 * (useBarScroll includes it; this is for a list that doesn't shrink the
 * bar, such as a member's chat.)
 */
export function useBarScrollTarget(): (node: Scrollable | null) => void {
  const setters = useContext(SettersContext);
  const id = useId();
  useFocusEffect(
    useCallback(() => {
      setters?.focusScroller(id, true);
      return () => setters?.focusScroller(id, false);
    }, [setters, id])
  );
  useEffect(() => () => setters?.setScroller(id, null), [setters, id]);
  return useCallback((node: Scrollable | null) => setters?.setScroller(id, node), [setters, id]);
}

/**
 * Hand to a tab page's main ScrollView or FlatList: the bar shrinks as the
 * page scrolls down and comes back on the way up or near the top, and
 * tapping the page's tab again takes it back to the top.
 */
export function useBarScroll(): {
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle: number;
  ref: (node: Scrollable | null) => void;
} {
  const setters = useContext(SettersContext);
  const ref = useBarScrollTarget();
  const last = useRef(0);
  const lastFrame = useRef(0);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      // The top buttons follow every frame; the bar below only on clear moves.
      setters?.headerScroll(y, y - lastFrame.current);
      lastFrame.current = y;
      const dy = y - last.current;
      if (y < 40) setters?.setCollapsed(false);
      else if (dy > 6) setters?.setCollapsed(true);
      else if (dy < -6) setters?.setCollapsed(false);
      if (Math.abs(dy) > 6 || y < 40) last.current = y;
    },
    [setters]
  );
  // A page coming back on screen, or left for one that doesn't scroll it, has the bar full size.
  useFocusEffect(
    useCallback(() => {
      setters?.setCollapsed(false);
      setters?.showHeader();
      return () => {
        setters?.setCollapsed(false);
        setters?.showHeader();
      };
    }, [setters])
  );
  return { onScroll, scrollEventThrottle: 16, ref };
}

/** The floating top buttons' offset (for components/top-bar.tsx). */
export function useTopBarOffset(): Animated.Value {
  const setters = useContext(SettersContext);
  const fallback = useRef(new Animated.Value(0)).current;
  return setters?.header ?? fallback;
}

/** The floating top buttons' row: a tab page starts below it (it scrolls up from under them). */
export const TOP_BAR_ROW = 60;
export function useTopBarInset(): number {
  return useSafeAreaInsets().top + TOP_BAR_ROW;
}
