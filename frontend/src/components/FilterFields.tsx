import { filterLabels, type FilterDraft, type FilterErrors } from '../search/filters';

export interface FieldsProps {
  fields: (keyof FilterDraft)[];
  prefix: string;
  draft: FilterDraft;
  errors: FilterErrors;
  onChange: (key: keyof FilterDraft, value: string) => void;
}

export function FilterFields({ fields, prefix, draft, errors, onChange }: FieldsProps) {
  return fields.map(key => {
    const id = `${prefix}-${key}`;
    const numeric = key !== 'city' && key !== 'keyword';
    return <div className="filter-field" key={key}>
      <label htmlFor={id}>{filterLabels[key]}</label>
      <input id={id} name={key} type="text" inputMode={numeric ? (key === 'minBedrooms' ? 'numeric' : 'decimal') : undefined}
        value={draft[key]} onChange={event => onChange(key, event.target.value)}
        placeholder={numeric ? 'Any' : key === 'city' ? 'e.g. Springfield' : 'e.g. garden, garage, transit'}
        aria-invalid={errors[key] ? true : undefined} aria-describedby={errors[key] ? `${id}-error` : undefined} />
      {errors[key] && <p className="field-error" id={`${id}-error`}>{errors[key]}</p>}
    </div>;
  });
}

