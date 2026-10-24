import { BedroomSelection } from './BedroomSelection';
import { FilterFields, type FieldsProps } from './FilterFields';
import { PriceRange } from './PriceRange';

const previews = [
  ['Property type', 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-8h6v8'],
  ['Amenities', 'm12 2-7 9h4l-5 7h7v4m1-20 7 9h-4l5 7h-8'],
  ['Lifestyle', 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'],
  ['Listing preferences', 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h6'],
] as const;

/** The panel edits the same six supported draft fields; roadmap previews never enter the draft. */
export function AdvancedFilterFields(props: Omit<FieldsProps, 'fields'>) {
  const { prefix, draft, errors, onChange } = props;
  const bedroomId = `${prefix}-precise-bedrooms`;
  return <>
    <div className="market-preview" role="group" aria-label="Marketplace preview" aria-describedby={`${prefix}-market-hint`}>
      <button type="button" aria-pressed="true">Buy</button>
      <button type="button" disabled>Rent <span className="coming-soon">Coming soon</span></button>
    </div>
    <p id={`${prefix}-market-hint`} className="filter-hint">Marketplace preview. Sale or rental availability is not verified.</p>
    <FilterFields {...props} fields={['city']} />
    <PriceRange {...props} inline showDistribution />
    <div className="advanced-bedrooms">
      <BedroomSelection options={['', '1', '2', '3']} value={draft.minBedrooms} onChange={value => onChange('minBedrooms', value)} />
      <div className="filter-field">
        <label htmlFor={bedroomId}>Exact minimum bedrooms</label>
        <input id={bedroomId} type="text" inputMode="numeric" placeholder="Any" value={draft.minBedrooms}
          onChange={event => onChange('minBedrooms', event.target.value)} aria-invalid={errors.minBedrooms ? true : undefined}
          aria-describedby={`${bedroomId}-hint${errors.minBedrooms ? ` ${bedroomId}-error` : ''}`} />
        <p className="filter-hint" id={`${bedroomId}-hint`}>Enter any whole number, including 0 or more than 3.</p>
        {errors.minBedrooms && <p className="field-error" id={`${bedroomId}-error`}>{errors.minBedrooms}</p>}
      </div>
    </div>
    <FilterFields {...props} fields={['targetBudget']} />
    <p className="filter-hint">Your target budget influences relevance ranking. It does not limit the maximum listing price.</p>
    <FilterFields {...props} fields={['keyword']} />
    <p className="filter-hint">Matches text in the listing description, regardless of letter case.</p>
    <div className="future-filters" role="group" aria-label="Future filter categories">
      {previews.map(([name, path]) => <button key={name} type="button" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d={path} /></svg>
        <span>{name}{' '}<span className="coming-soon">Coming soon</span></span>
      </button>)}
    </div>
  </>;
}
