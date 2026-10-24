import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BedroomStepper } from './BedroomStepper';

function Fixture({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <BedroomStepper value={value} onChange={setValue} />;
}
it('starts at Any, steps beyond five, and returns to Any without a negative value', () => {
  render(<Fixture />);
  const field = screen.getByLabelText('Minimum bedrooms');
  const down = screen.getByRole('button', { name: 'Decrease minimum bedrooms' });
  expect(field).toHaveValue(''); expect(field).toHaveAttribute('placeholder', 'Any'); expect(down).toBeDisabled();
  for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Increase minimum bedrooms' }));
  expect(field).toHaveValue('7');
  for (let i = 0; i < 8; i++) fireEvent.click(down);
  expect(field).toHaveValue(''); expect(down).toBeDisabled();
});
it('supports keyboard arrows, exact zero, invalid drafts and safe stepping without rewriting typed values', () => {
  render(<Fixture initial="0" />);
  const field = screen.getByLabelText('Minimum bedrooms');
  fireEvent.keyDown(field, { key: 'ArrowDown' }); expect(field).toHaveValue('');
  fireEvent.keyDown(field, { key: 'ArrowUp' }); expect(field).toHaveValue('1');
  fireEvent.change(field, { target: { value: '1.5' } });
  expect(screen.getByRole('button', { name: 'Increase minimum bedrooms' })).toBeDisabled();
  fireEvent.keyDown(field, { key: 'ArrowUp' }); expect(field).toHaveValue('1.5');
  fireEvent.change(field, { target: { value: String(Number.MAX_SAFE_INTEGER) } });
  expect(screen.getByRole('button', { name: 'Increase minimum bedrooms' })).toBeDisabled();
  fireEvent.keyDown(field, { key: 'ArrowUp' }); expect(field).toHaveValue(String(Number.MAX_SAFE_INTEGER));
});

it('connects exact typed input to the existing validation message', () => {
  render(<BedroomStepper value="-1" error="Minimum bedrooms must be zero or greater." onChange={() => {}} />);
  expect(screen.getByLabelText('Minimum bedrooms')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText('Minimum bedrooms')).toHaveAccessibleDescription('Minimum bedrooms must be zero or greater.');
});
