import type { Metadata } from "next";

import { apiGet } from "@/lib/api";
import { requireProvider } from "@/lib/guards";
import { weekdayIndexFromName } from "@/lib/constants";
import type { AvailabilityWindow } from "@/lib/types";

import { PageHeader } from "@/components/shell/PageHeader";
import { AvailabilityEditor } from "@/components/provider/AvailabilityEditor";
import { TimeOffManager } from "@/components/provider/TimeOffManager";

export const metadata: Metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

type TimeOffRow = { id: string; startAt: string; endAt: string; reason: string };

export default async function AvailabilityPage() {
  await requireProvider();

  const [windows, timeOff] = await Promise.all([
    apiGet<AvailabilityWindow[]>("/api/provider/availability"),
    apiGet<TimeOffRow[]>("/api/provider/time-off"),
  ]);

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle="Set the hours you work each week. Students only ever see slots that fit inside them."
      />

      <div className="space-y-6">
        <AvailabilityEditor
          initialRules={windows.map((window) => ({
            // The editor works in JS weekday numbers; the API speaks DayOfWeek names.
            weekday: weekdayIndexFromName(window.dayOfWeek),
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          }))}
        />

        <TimeOffManager
          blocks={timeOff.map((entry) => ({
            id: entry.id,
            startAt: entry.startAt,
            endAt: entry.endAt,
            reason: entry.reason || null,
          }))}
        />
      </div>
    </>
  );
}
