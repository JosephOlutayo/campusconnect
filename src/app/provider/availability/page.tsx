import type { Metadata } from "next";

import { requireProvider } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "@/lib/time";

import { PageHeader } from "@/components/shell/PageHeader";
import { AvailabilityEditor } from "@/components/provider/AvailabilityEditor";
import { TimeOffManager } from "@/components/provider/TimeOffManager";

export const metadata: Metadata = { title: "Availability" };
export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const { providerId } = await requireProvider();

  const [rules, timeOff, profile] = await Promise.all([
    prisma.availabilityRule.findMany({
      where: { providerId },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
      select: { weekday: true, startMinute: true, endMinute: true },
    }),
    prisma.timeOff.findMany({
      where: { providerId, endAt: { gte: startOfDay(new Date()) } },
      orderBy: { startAt: "asc" },
    }),
    prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerId },
      select: { bufferMinutes: true, minNoticeMinutes: true, maxAdvanceDays: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle="Your weekly hours are what the booking calendar offers students. Nothing outside these windows can be booked."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <AvailabilityEditor initialRules={rules} />
        </div>

        <aside className="space-y-5">
          <TimeOffManager
            blocks={timeOff.map((block) => ({
              id: block.id,
              startAt: block.startAt.toISOString(),
              endAt: block.endAt.toISOString(),
              reason: block.reason,
            }))}
          />

          <section className="card p-5">
            <h2 className="text-base font-semibold text-ink">Booking rules</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-ink">Buffer between appointments</dt>
                <dd className="text-ink-muted">
                  {profile.bufferMinutes} minutes of turnaround is reserved after every booking.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Minimum notice</dt>
                <dd className="text-ink-muted">
                  Students cannot book within{" "}
                  {profile.minNoticeMinutes >= 60
                    ? `${Math.round(profile.minNoticeMinutes / 60)} hours`
                    : `${profile.minNoticeMinutes} minutes`}{" "}
                  of now.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Booking window</dt>
                <dd className="text-ink-muted">
                  Up to {profile.maxAdvanceDays} days ahead.
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-ink-muted">
              Change these in{" "}
              <a href="/provider/settings" className="font-semibold text-accent hover:underline">
                business settings
              </a>
              .
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
