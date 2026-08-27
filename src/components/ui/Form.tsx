import type { ComponentProps, ReactNode } from "react";

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3">
      <span className="text-sm font-semibold text-ink">{children}</span>
      {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
      {children}
    </p>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-ink-muted">{children}</p>;
}

type TextFieldProps = ComponentProps<"input"> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, className = "", id, ...rest }: TextFieldProps) {
  const fieldId = id ?? rest.name;
  return (
    <div>
      {label ? <Label htmlFor={fieldId}>{label}</Label> : null}
      <input
        id={fieldId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={`field ${error ? "border-danger" : ""} ${className}`}
      />
      {hint && !error ? <Hint>{hint}</Hint> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

type TextAreaProps = ComponentProps<"textarea"> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function TextArea({ label, hint, error, className = "", id, ...rest }: TextAreaProps) {
  const fieldId = id ?? rest.name;
  return (
    <div>
      {label ? <Label htmlFor={fieldId}>{label}</Label> : null}
      <textarea
        id={fieldId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={`field min-h-24 resize-y ${error ? "border-danger" : ""} ${className}`}
      />
      {hint && !error ? <Hint>{hint}</Hint> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

type SelectProps = ComponentProps<"select"> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Select({ label, hint, error, className = "", id, children, ...rest }: SelectProps) {
  const fieldId = id ?? rest.name;
  return (
    <div>
      {label ? <Label htmlFor={fieldId}>{label}</Label> : null}
      <select
        id={fieldId}
        {...rest}
        aria-invalid={error ? true : undefined}
        className={`field appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="%2382828e"><path d="M5.5 7.5L10 12l4.5-4.5z"/></svg>')] bg-[length:20px_20px] bg-[right_0.6rem_center] bg-no-repeat pr-9 ${
          error ? "border-danger" : ""
        } ${className}`}
      >
        {children}
      </select>
      {hint && !error ? <Hint>{hint}</Hint> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className = "",
  id,
  ...rest
}: ComponentProps<"input"> & { label: string; description?: string }) {
  const fieldId = id ?? rest.name;
  return (
    <label
      htmlFor={fieldId}
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 transition-colors hover:bg-surface-muted has-checked:border-accent has-checked:bg-accent-soft ${className}`}
    >
      <input
        id={fieldId}
        type="checkbox"
        {...rest}
        className="mt-0.5 size-4.5 shrink-0 accent-accent"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
