"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { FormError } from "@/components/ui/Form";
import { formatMinutes, WEEKDAY_NAMES } from "@/lib/time";

export type Rule = { weekday: number; startMinute: number; endMinute: number };

type Props = {
  initialRules: Rule[];
};

/** 6am to 11pm in half-hour steps — the realistic range for campus work. */
const OPTIONS = Array.from({ length: 35 }, (_, index) => 6 * 60 + index * 30);

const PRESETS = [
  { label: "Weekdays 10–6", days: [1, 2, 3, 4, 5], start: 600, end: 1080 },
  { label: "Evenings 4–9", days: [1, 2, 3, 4, 5], start: 960, end: 1260 },
  { label: "Weekends 10–6", days: [0, 6], start: 600, end: 1080 },
];

export function AvailabilityEditor({ initialRules }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const forDay = (weekday: number) => rules.filter((rule) => rule.weekday === weekday);

  const addWindow = (weekday: number) => {
    const existing = forDay(weekday);
    // Start the new window after the last one so it does not overlap by default.
    const start = existing.length > 0 ? Math.min(1320, Math.max(...existing.map((r) => r.endMinute)) + 30) : 600;
    setRules([...rules, { weekday, startMinute: start, endMinute: Math.min(1380, start + 240) }]);
  };

  const removeWindow = (weekday: number, index: number) => {
    let seen = -1;
    setRules(
      rules.filter((rule) => {
        if (rule.weekday !== weekday) return true;
        seen += 1;
        return seen !== index;
      }),
    );
  };

  const updateWindow = (weekday: number, index: number, patch: Partial<Rule>) => {
    let seen = -1;
    setRules(
      rules.map((rule) => {
        if (rule.weekday !== weekday) return rule;
        seen += 1;
        return seen === index ? { ...rule, ...patch } : rule;
      }),
    );
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setRules(
      preset.days.map((weekday) => ({
        weekday,
        startMinute: preset.start,
        endMinute: preset.end,
      })),
    );
  };

  const save = async () => {
    setSaving(true);
    setError("");

    const invalid = rules.find((rule) => rule.endMinute <= rule.startMinute);
    if (invalid) {
      setError(`${WEEKDAY_NAMES[invalid.weekday]} has a window that ends before it starts.`);
      setSaving(false);
      return;
    }

    const response = await fetch("/api/provider/availability", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rules }),
    });
    const payload = await response.json();

    setSaving(false);
    if (!payload.ok) {
      setError(payload.error ?? "Could not save your hours.");
      return;
    }

    toast("Hours saved. Students see the new slots immediately.");
    router.refresh();
  };

  const totalHours =
    rules.reduce((sum, rule) => sum + (rule.endMinute - rule.startMinute), 0) / 60;

  return (
    <div className="space-y-5">
      <FormError>{error}</FormError>

      <section className="card p-5">
        <h2 className="text-base font-semibold text-ink">Start from a preset</h2>
        <p className="mt-1 mb-3 text-sm text-ink-muted">
          Replaces your whole week — adjust from there.
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        {WEEKDAY_NAMES.map((day, weekday) => {
          const windows = forDay(weekday);
          return (
            <section key={day} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-ink">{day}</h3>
                <button
                  onClick={() => addWindow(weekday)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft"
                >
                  <Icon name="plus" size={14} />
                  Add window
                </button>
              </div>

              {windows.length === 0 ? (
                <p className="mt-2 text-sm text-ink-faint">Closed</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {windows.map((window, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <select
                        value={window.startMinute}
                        onChange={(event) =>
                          updateWindow(weekday, index, { startMinute: Number(event.target.value) })
                        }
                        aria-label={`${day} window ${index + 1} start`}
                        className="field w-auto py-1.5 text-sm"
                      >
                        {OPTIONS.map((minute) => (
                          <option key={minute} value={minute}>
                            {formatMinutes(minute)}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-ink-muted">to</span>
                      <select
                        value={window.endMinute}
                        onChange={(event) =>
                          updateWindow(weekday, index, { endMinute: Number(event.target.value) })
                        }
                        aria-label={`${day} window ${index + 1} end`}
                        className="field w-auto py-1.5 text-sm"
                      >
                        {OPTIONS.map((minute) => (
                          <option key={minute} value={minute}>
                            {formatMinutes(minute)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeWindow(weekday, index)}
                        aria-label={`Remove ${day} window ${index + 1}`}
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-ink-muted">
                    Two windows on one day is how you take a break — for example 9–12 and 2–6.
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-20 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)] md:bottom-4">
        <p className="min-w-0 flex-1 text-sm text-ink-muted">
          <strong className="text-ink">{totalHours.toFixed(1)} hours</strong> open per week
        </p>
        <Button onClick={save} loading={saving}>
          Save hours
        </Button>
      </div>
    </div>
  );
}
