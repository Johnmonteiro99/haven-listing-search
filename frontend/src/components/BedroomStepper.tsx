import { useId } from 'react';

interface BedroomStepperProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

/** The empty draft means Any. Buttons step safely; exact typed values use existing validation. */
export function BedroomStepper({ value, error, onChange }: BedroomStepperProps) {
  const id = useId();
  const empty = !value.trim();
  const numeric = Number(value);
  const canStep = empty || (Number.isSafeInteger(numeric) && numeric >= 0);
  function step(direction: -1 | 1) {
    if (!canStep || (direction === 1 && numeric >= Number.MAX_SAFE_INTEGER)) return;
    const next = (empty ? 0 : numeric) + direction;
    onChange(next < 1 ? '' : String(next));
  }
  return <div className="bedroom-stepper">
    <label className="control-label" htmlFor={id}>Minimum bedrooms</label>
    <div className="bedroom-stepper-control" role="group" aria-label="Bedroom minimum controls">
      <button type="button" aria-label="Decrease minimum bedrooms" disabled={empty || !canStep} onClick={() => step(-1)}>−</button>
      <div className="bedroom-stepper-value">
        <input id={id} type="text" inputMode="numeric" value={value} placeholder="Any"
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault(); step(event.key === 'ArrowUp' ? 1 : -1);
            }
          }} />
      </div>
      <button type="button" aria-label="Increase minimum bedrooms" disabled={!canStep || numeric >= Number.MAX_SAFE_INTEGER} onClick={() => step(1)}>+</button>
    </div>
    <span id={`${id}-hint`} className="visually-hidden">A minimum; blank means Any. Use plus and minus, arrow keys, or enter a whole number.</span>
    {error && <p id={`${id}-error`} className="field-error">{error}</p>}
  </div>;
}
