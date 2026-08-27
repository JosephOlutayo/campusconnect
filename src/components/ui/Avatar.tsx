import { initials, seedGradient } from "@/lib/avatar";

const sizeMap = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
  "2xl": "size-28 text-3xl",
} as const;

export type AvatarSize = keyof typeof sizeMap;

type Props = {
  seed: string;
  name: string;
  size?: AvatarSize;
  className?: string;
  ring?: boolean;
};

/**
 * Every account gets a stable gradient monogram. No external avatar service,
 * no broken-image states, and the same person looks the same everywhere.
 */
export function Avatar({ seed, name, size = "md", className = "", ring = false }: Props) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none ${sizeMap[size]} ${
        ring ? "ring-2 ring-white" : ""
      } ${className}`}
      style={{ backgroundImage: seedGradient(seed) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

type StackProps = {
  people: Array<{ seed: string; name: string }>;
  size?: AvatarSize;
  max?: number;
};

export function AvatarStack({ people, size = "sm", max = 3 }: StackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((person, index) => (
        <Avatar key={`${person.seed}-${index}`} {...person} size={size} ring />
      ))}
      {extra > 0 ? (
        <span
          className={`inline-flex items-center justify-center rounded-full bg-surface-sunken font-semibold text-ink-muted ring-2 ring-white ${sizeMap[size]}`}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
