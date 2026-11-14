"use client";

// A small set of mutually exclusive choices, shown side by side.
export function Segmented<T extends string | boolean>({
  value,
  options,
  onChange,
  disabled,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "min-h-10 px-3 py-1 text-sm" : "min-h-11 px-4 py-1.5 text-base";
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex max-w-full flex-wrap rounded-3xl bg-cream-200 p-1 ring-1 ring-maroon-900/10 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-full font-semibold transition-colors ${pad} ${
              active ? "bg-maroon-700 text-cream-50 shadow-sm" : "text-maroon-800 hover:bg-cream-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
