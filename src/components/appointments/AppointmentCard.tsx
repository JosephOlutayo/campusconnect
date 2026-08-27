import Link from "next/link";

import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatCents } from "@/lib/money";
import { durationLabel, formatRelativeDay, formatTimeRange } from "@/lib/time";

type Props = {
  appointment: {
    id: string;
    code: string;
    startAt: Date;
    endAt: Date;
    status: string;
    priceCents: number;
    locationLabel: string;
    service: { title: string; durationMinutes?: number };
    provider: { id: string; businessName: string; user: { avatarSeed: string } };
  };
  compact?: boolean;
};

export function AppointmentCard({ appointment, compact = false }: Props) {
  return (
    <Link
      href={`/appointments/${appointment.id}`}
      className="card card-hover block p-4"
      aria-label={`${appointment.service.title} with ${appointment.provider.businessName}`}
    >
      <div className="flex items-start gap-3">
        <Avatar
          seed={appointment.provider.user.avatarSeed}
          name={appointment.provider.businessName}
          size={compact ? "sm" : "md"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-ink">
              {appointment.service.title}
            </p>
            <StatusBadge status={appointment.status} short />
          </div>
          <p className="truncate text-[13px] text-ink-muted">
            {appointment.provider.businessName}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <Icon name="calendar" size={14} className="text-ink-muted" />
              {formatRelativeDay(appointment.startAt)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <Icon name="clock" size={14} className="text-ink-muted" />
              {formatTimeRange(appointment.startAt, appointment.endAt)}
            </span>
          </div>

          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-muted">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Icon name="pin" size={14} />
                <span className="truncate">{appointment.locationLabel}</span>
              </span>
              <span className="font-semibold text-ink">{formatCents(appointment.priceCents)}</span>
              {appointment.service.durationMinutes ? (
                <span>{durationLabel(appointment.service.durationMinutes)}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
