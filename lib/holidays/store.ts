"use client";

/**
 * Holidays store (scaffold — localStorage).
 * -----------------------------------------
 * The shared list of business closures the trainer adds on the dashboard and
 * the public holidays page reads. Client-only stand-in for lib/holidays/data.ts
 * (the backend seam), following the same store shape as the other nn-* stores.
 */
import { useSyncExternalStore } from "react";
import type { Holiday, HolidayCustomer } from "./types";
import { ANNUAL_HOLIDAY_ALLOWANCE } from "./types";
import { isoToNum, rangeCoversISO, yearOf } from "./dates";
import type { DaySchedule } from "@/lib/schedule/types";
import { publishHoliday, unpublishHoliday, scheduleHolidayReminders } from "./data";

const EMPTY: Holiday[] = [];
const KEY = "nn-holidays";
const EVENT = "nn-holidays-change";

function read(): Holiday[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Holiday[];
  } catch {
    return EMPTY;
  }
}

function write(list: Holiday[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

/** Add a closure and mark one holiday used against each active member. */
export function addHoliday(h: Holiday, customers: HolidayCustomer[]) {
  const list = [h, ...read().filter((x) => x.id !== h.id)];
  list.sort((a, b) => isoToNum(a.start) - isoToNum(b.start));
  write(list);
  void publishHoliday(h, customers);
  void scheduleHolidayReminders(h, customers);
}

export function removeHoliday(id: string) {
  write(read().filter((h) => h.id !== id));
  void unpublishHoliday(id);
}

// --- pure selectors (safe to call from render) ----------------------------

/** Closures whose first day falls in `year`. */
export function holidaysInYear(list: Holiday[], year: number): Holiday[] {
  return list.filter((h) => yearOf(h.start) === year);
}

/** The closure covering a given date, if any (for "no session" checks). */
export function holidayCoveringDate(list: Holiday[], iso: string): Holiday | null {
  return list.find((h) => rangeCoversISO(h.start, h.end, iso)) ?? null;
}

/** Holidays used so far in `year` — one per closure (business closes for all). */
export function holidaysUsed(list: Holiday[], year: number): number {
  return holidaysInYear(list, year).length;
}

export function remainingAllowance(list: Holiday[], year: number): number {
  return Math.max(0, ANNUAL_HOLIDAY_ALLOWANCE - holidaysUsed(list, year));
}

/**
 * Everyone on the schedule, deduped to one row per customer (by email, else
 * name). Two dogs or two training days collapse into a single row — a closure
 * only ever costs that customer one holiday.
 */
export function rosterCustomers(week: DaySchedule[]): HolidayCustomer[] {
  const map = new Map<string, HolidayCustomer>();
  for (const day of week) {
    for (const dog of day.dogs) {
      const key = (dog.email || dog.ownerName).toLowerCase();
      const existing = map.get(key);
      if (existing) {
        if (!existing.dogNames.includes(dog.name)) existing.dogNames.push(dog.name);
        if (!existing.days.includes(day.day)) existing.days.push(day.day);
      } else {
        map.set(key, {
          key,
          ownerName: dog.ownerName,
          email: dog.email,
          dogNames: [dog.name],
          days: [day.day],
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.ownerName.localeCompare(b.ownerName));
}

// --- hook -----------------------------------------------------------------

let cache: Holiday[] = EMPTY;
let cacheRaw: string | null | undefined = undefined;

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): Holiday[] {
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

function getServerSnapshot(): Holiday[] {
  return EMPTY;
}

export function useHolidays(): Holiday[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
