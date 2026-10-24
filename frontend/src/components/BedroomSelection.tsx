/** Native buttons expose a single selected minimum; Any omits the API filter. */
export function BedroomSelection({ value, onChange, options = ['', '1', '2', '3', '4', '5'] }: { value: string; onChange: (value: string) => void; options?: readonly string[] }) {
  const label = value && !options.includes(value) ? `Minimum bedrooms · ${value}+` : 'Minimum bedrooms';
  return <fieldset className="bedroom-selection">
    <legend>{label}</legend>
    <div className="bedroom-options">
      {options.map(option => <button key={option} type="button"
        aria-pressed={value === option} onClick={() => onChange(option)}>
        {option ? `${option}+` : 'Any'}
      </button>)}
    </div>
  </fieldset>;
}
