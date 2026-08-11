import { PawIcon, HandshakeIcon, CheckIcon } from "./Icons";

const icons = {
  paw: PawIcon,
  handshake: HandshakeIcon,
} as const;

export type SelectOption = {
  value: string;
  label: string;
  desc?: string;
  price?: string;
  icon?: keyof typeof icons;
};

type SelectCardsProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3;
  ariaLabel: string;
};

/** Tappable single-select cards (radio group) — the selected card highlights. */
export function SelectCards({
  options,
  value,
  onChange,
  columns = 2,
  ariaLabel,
}: SelectCardsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid gap-3 ${columns === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        const Icon = opt.icon ? icons[opt.icon] : null;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`relative rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected
                ? "border-paper bg-white/10"
                : "border-white/15 bg-white/[0.03] hover:border-white/35"
            }`}
          >
            {selected && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-paper text-ink">
                <CheckIcon width={13} height={13} />
              </span>
            )}
            {Icon && (
              <Icon
                width={26}
                height={26}
                className={selected ? "text-paper" : "text-paper/70"}
              />
            )}
            <span
              className={`block font-semibold text-paper ${Icon ? "mt-3" : ""}`}
            >
              {opt.label}
            </span>
            {opt.price && (
              <span className="mt-1 block text-sm font-semibold text-paper">
                {opt.price}
              </span>
            )}
            {opt.desc && (
              <span className="mt-1 block text-sm text-paper/60">{opt.desc}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
