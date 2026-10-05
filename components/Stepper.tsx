"use client";

import { useL } from "./LangProvider";

export function Stepper(props: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const { label, hint, value, min, max, onChange } = props;
  const { l } = useL();
  return (
    <div className="stepper">
      <div>
        <div className="stepper-label">{label}</div>
        {hint && <div className="stepper-hint">{hint}</div>}
      </div>
      <div className="stepper-controls">
        <button type="button" aria-label={l(`Fewer ${label.toLowerCase()}`, `Menos ${label.toLowerCase()}`)} disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <span aria-live="polite">{value}</span>
        <button type="button" aria-label={l(`More ${label.toLowerCase()}`, `Más ${label.toLowerCase()}`)} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
