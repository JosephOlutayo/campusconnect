import { prisma } from "@/lib/prisma";
import { BLOCKING_STATUSES } from "@/lib/constants";
import {
  addDays,
  addMinutes,
  atMinuteOfDay,
  endOfDay,
  fromDateKey,
  startOfDay,
  toDateKey,
  type DateKey,
} from "@/lib/time";

/** Slots are offered on a 15-minute grid regardless of service length. */
export const SLOT_STEP_MINUTES = 15;

export type Slot = { startAt: Date; endAt: Date };

export type WeeklyRule = { weekday: number; startMinute: number; endMinute: number };
export type BusyInterval = { start: Date; end: Date };

export type ProviderPolicy = {
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
};

type ComputeArgs = {
  day: Date;
  durationMinutes: number;
  policy: ProviderPolicy;
  rules: WeeklyRule[];
  /** Existing appointments AND time off, already expanded to instants. */
  busy: BusyInterval[];
  now?: Date;
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Pure slot generator — no database access, so the batch path and the
 * single-day path share exactly one implementation of the rules.
 */
export function computeDaySlots({
  day,
  durationMinutes,
  policy,
  rules,
  busy,
  now = new Date(),
}: ComputeArgs): Slot[] {
  if (durationMinutes <= 0) return [];

  const dayStart = startOfDay(day);
  const horizon = addDays(startOfDay(now), policy.maxAdvanceDays);
  if (dayStart > horizon) return [];
  if (dayStart < startOfDay(now)) return [];

  const earliest = addMinutes(now, policy.minNoticeMinutes);
  const todaysRules = rules.filter((rule) => rule.weekday === dayStart.getDay());
  const slots: Slot[] = [];

  for (const rule of todaysRules) {
    for (
      let minute = rule.startMinute;
      minute + durationMinutes <= rule.endMinute;
      minute += SLOT_STEP_MINUTES
    ) {
      const startAt = atMinuteOfDay(dayStart, minute);
      const endAt = addMinutes(startAt, durationMinutes);
      // The provider is occupied until the buffer clears, even though the
      // customer's appointment ends earlier.
      const blockEndAt = addMinutes(endAt, policy.bufferMinutes);

      if (startAt < earliest) continue;

      const clash = busy.some((interval) =>
        overlaps(startAt, blockEndAt, interval.start, interval.end),
      );
      if (clash) continue;

      slots.push({ startAt, endAt });
    }
  }

  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

type ProviderScheduleData = {
  policy: ProviderPolicy;
  rules: WeeklyRule[];
  busy: BusyInterval[];
};

/**
 * Loads everything the generator needs for one provider across a date window.
 * Appointment blocks use blockEndAt (end + buffer) so turnaround time is
 * already baked into the busy interval.
 */
async function loadSchedule(
  providerId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<ProviderScheduleData | null> {
  const [provider, rules, appointments, timeOff] = await Promise.all([
    prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: { bufferMinutes: true, minNoticeMinutes: true, maxAdvanceDays: true },
    }),
    prisma.availabilityRule.findMany({
      where: { providerId },
      select: { weekday: true, startMinute: true, endMinute: true },
    }),
    prisma.appointment.findMany({
      where: {
        providerId,
        status: { in: BLOCKING_STATUSES },
        startAt: { lt: windowEnd },
        blockEndAt: { gt: windowStart },
      },
      select: { startAt: true, blockEndAt: true },
    }),
    prisma.timeOff.findMany({
      where: { providerId, startAt: { lt: windowEnd }, endAt: { gt: windowStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);

  if (!provider) return null;

  return {
    policy: provider,
    rules,
    busy: [
      ...appointments.map((a) => ({ start: a.startAt, end: a.blockEndAt })),
      ...timeOff.map((t) => ({ start: t.startAt, end: t.endAt })),
    ],
  };
}

export async function getDaySlots(
  providerId: string,
  durationMinutes: number,
  dateKey: DateKey,
  opts: { excludeAppointmentId?: string } = {},
): Promise<Slot[]> {
  const day = fromDateKey(dateKey);
  const schedule = await loadSchedule(providerId, startOfDay(day), endOfDay(day));
  if (!schedule) return [];

  let busy = schedule.busy;
  if (opts.excludeAppointmentId) {
    // Rescheduling must not treat the appointment being moved as a conflict.
    const current = await prisma.appointment.findUnique({
      where: { id: opts.excludeAppointmentId },
      select: { startAt: true, blockEndAt: true },
    });
    if (current) {
      busy = busy.filter(
        (interval) =>
          !(
            interval.start.getTime() === current.startAt.getTime() &&
            interval.end.getTime() === current.blockEndAt.getTime()
          ),
      );
    }
  }

  return computeDaySlots({
    day,
    durationMinutes,
    policy: schedule.policy,
    rules: schedule.rules,
    busy,
  });
}

/** Which of the next `days` calendar days have at least one open slot. */
export async function getOpenDays(
  providerId: string,
  durationMinutes: number,
  from: Date,
  days: number,
): Promise<Set<DateKey>> {
  const windowStart = startOfDay(from);
  const windowEnd = endOfDay(addDays(windowStart, days));
  const schedule = await loadSchedule(providerId, windowStart, windowEnd);
  const open = new Set<DateKey>();
  if (!schedule) return open;

  for (let i = 0; i <= days; i += 1) {
    const day = addDays(windowStart, i);
    const slots = computeDaySlots({
      day,
      durationMinutes,
      policy: schedule.policy,
      rules: schedule.rules,
      busy: schedule.busy,
    });
    if (slots.length > 0) open.add(toDateKey(day));
  }

  return open;
}

export async function getNextAvailable(
  providerId: string,
  durationMinutes: number,
  lookaheadDays = 21,
): Promise<Date | null> {
  const now = new Date();
  const schedule = await loadSchedule(
    providerId,
    startOfDay(now),
    endOfDay(addDays(now, lookaheadDays)),
  );
  if (!schedule) return null;

  for (let i = 0; i <= lookaheadDays; i += 1) {
    const slots = computeDaySlots({
      day: addDays(now, i),
      durationMinutes,
      policy: schedule.policy,
      rules: schedule.rules,
      busy: schedule.busy,
      now,
    });
    if (slots.length > 0) return slots[0].startAt;
  }
  return null;
}

/**
 * Search results show "next available" for every card. Doing that one provider
 * at a time would be N+1 queries per page; this pulls the whole window in three
 * queries and runs the generator in memory.
 */
export async function getNextAvailableForProviders(
  entries: Array<{ providerId: string; durationMinutes: number }>,
  lookaheadDays = 14,
): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  const providerIds = Array.from(new Set(entries.map((e) => e.providerId)));
  if (providerIds.length === 0) return result;

  const now = new Date();
  const windowStart = startOfDay(now);
  const windowEnd = endOfDay(addDays(now, lookaheadDays));

  const [providers, rules, appointments, timeOff] = await Promise.all([
    prisma.providerProfile.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, bufferMinutes: true, minNoticeMinutes: true, maxAdvanceDays: true },
    }),
    prisma.availabilityRule.findMany({
      where: { providerId: { in: providerIds } },
      select: { providerId: true, weekday: true, startMinute: true, endMinute: true },
    }),
    prisma.appointment.findMany({
      where: {
        providerId: { in: providerIds },
        status: { in: BLOCKING_STATUSES },
        startAt: { lt: windowEnd },
        blockEndAt: { gt: windowStart },
      },
      select: { providerId: true, startAt: true, blockEndAt: true },
    }),
    prisma.timeOff.findMany({
      where: { providerId: { in: providerIds }, startAt: { lt: windowEnd }, endAt: { gt: windowStart } },
      select: { providerId: true, startAt: true, endAt: true },
    }),
  ]);

  const policyById = new Map(providers.map((p) => [p.id, p]));
  const rulesById = new Map<string, WeeklyRule[]>();
  for (const rule of rules) {
    const list = rulesById.get(rule.providerId) ?? [];
    list.push(rule);
    rulesById.set(rule.providerId, list);
  }
  const busyById = new Map<string, BusyInterval[]>();
  for (const appt of appointments) {
    const list = busyById.get(appt.providerId) ?? [];
    list.push({ start: appt.startAt, end: appt.blockEndAt });
    busyById.set(appt.providerId, list);
  }
  for (const off of timeOff) {
    const list = busyById.get(off.providerId) ?? [];
    list.push({ start: off.startAt, end: off.endAt });
    busyById.set(off.providerId, list);
  }

  for (const entry of entries) {
    if (result.has(entry.providerId)) continue;
    const policy = policyById.get(entry.providerId);
    if (!policy) continue;

    for (let i = 0; i <= lookaheadDays; i += 1) {
      const slots = computeDaySlots({
        day: addDays(now, i),
        durationMinutes: entry.durationMinutes,
        policy,
        rules: rulesById.get(entry.providerId) ?? [],
        busy: busyById.get(entry.providerId) ?? [],
        now,
      });
      if (slots.length > 0) {
        result.set(entry.providerId, slots[0].startAt);
        break;
      }
    }
  }

  return result;
}

/** Guard used at write time — the UI offers slots, this is what enforces them. */
export async function isSlotBookable(
  providerId: string,
  durationMinutes: number,
  startAt: Date,
  opts: { excludeAppointmentId?: string } = {},
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const slots = await getDaySlots(providerId, durationMinutes, toDateKey(startAt), opts);
  const match = slots.some((slot) => slot.startAt.getTime() === startAt.getTime());
  if (!match) {
    return { ok: false, reason: "That time is no longer available. Pick another slot." };
  }
  return { ok: true };
}
