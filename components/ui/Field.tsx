import type { ReactNode } from "react";

// Kanvas-style inputs: a quiet bordered box on the page background that
// brightens its border on focus. (Phones get 16px text via globals.css so iOS
// doesn't zoom into the field.)
const inputClass =
  "w-full rounded-lg border border-white/10 bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-paper-dim/70 outline-none transition-colors focus:border-white/40 aria-[invalid=true]:border-red-400/60";

type BaseProps = {
  label: ReactNode;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
};

export function Field({
  label,
  name,
  value,
  onChange,
  required,
  placeholder,
  error,
  type = "text",
  inputMode,
  textarea,
  rows = 4,
  options,
}: BaseProps & {
  type?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  textarea?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm text-paper-dim">
        {label}
        {required && <span className="text-paper-dim/70"> *</span>}
      </label>
      {options ? (
        <div className="relative">
          <select
            id={name}
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            className={`${inputClass} appearance-none pr-10`}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value} className="bg-ink text-paper">
                {o.label}
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-paper-dim"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      ) : textarea ? (
        <textarea
          id={name}
          name={name}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={inputClass}
        />
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
