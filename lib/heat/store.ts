"use client";

/**
 * Heat-days store (scaffold — localStorage).
 * ------------------------------------------
 * The shared list of severe-heat days the trainer marks on the dashboard. The
 * member profile reads it to flag the earlier collection/drop-off times on the
 * "Your next session" card. Same store shape as the other nn-* stores.
 */
import { useSyncExternalStore } from "react";
import type { HeatDay } from "./types";
import { isoToNum } from "@/lib/holidays/dates";
import type { DaySchedule } from "@/lib/schedule/types";
import { dayIdFromISO } from "@/lib/schedule/sessions";
import { publishHeatDay, unpublishHeatDay, type HeatRecipient } from "./data";

const EMPTY: HeatDay[] = [];
const KEY = "nn-heat-days";
const EVENT = "nn-heat-days-change";

function read(): HeatDay[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HeatDay[];
  } catch {
    return EMPTY;
  }
}

function write(list: HeatDay[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

/** Mark a date as a heat day and notify everyone with a session that day. */
export function addHeatDay(day: HeatDay, recipients: HeatRecipient[]) {
  const list = [day, ...read().filter((x) => x.date !== day.date)];
  list.sort((a, b) => isoToNum(a.date) - isoToNum(b.date));
  write(list);
  void publishHeatDay(day, recipients);
}

export function removeHeatDay(date: string) {
  write(read().filter((h) => h.date !== date));
  void unpublishHeatDay(date);
}

/** Is `iso` (YYYY-MM-DD) a marked heat day? */
export function isHeatDay(list: HeatDay[], iso: string): boolean {
  return list.some((h) => h.date === iso);
}

/**
 * The dogs training on a given date (the recurring roster for that weekday),
 * deduped to one row per owner — the people to notify about the earlier times.
 */
export function heatRecipients(week: DaySchedule[], dateISO: string): HeatRecipient[] {
  const day = dayIdFromISO(dateISO);
  const dogs = week.find((d) => d.day === day)?.dogs ?? [];
  const map = new Map<string, HeatRecipient>();
  for (const dog of dogs) {
    const key = (dog.email || dog.ownerName).toLowerCase();
    const existing = map.get(key);
    if (existing) {
      if (!existing.dogNames.includes(dog.name)) existing.dogNames.push(dog.name);
    } else {
      map.set(key, { ownerName: dog.ownerName, email: dog.email, dogNames: [dog.name] });
    }
  }
  return [...map.values()].sort((a, b) => a.ownerName.localeCompare(b.ownerName));
}

// --- hook -----------------------------------------------------------------

let cache: HeatDay[] = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): HeatDay[] {
  const raw = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = read();
  }
  return cache;
}

function getServerSnapshot(): HeatDay[] {
  return EMPTY;
}

export function useHeatDays(): HeatDay[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
