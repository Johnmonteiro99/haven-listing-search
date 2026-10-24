import type { SearchParams } from '../api/listings';

export const emptyFilters = { city: '', minPrice: '', maxPrice: '', minBedrooms: '', targetBudget: '', keyword: '' };
export type FilterDraft = typeof emptyFilters;
export type FilterErrors = Partial<Record<keyof FilterDraft | 'page' | 'pageSize', string>>;
export const defaultParams: SearchParams = { page: 1, pageSize: 10 };
export const filterLabels: Record<keyof FilterDraft, string> = {
  city: 'City', minPrice: 'Minimum price', maxPrice: 'Maximum price', minBedrooms: 'Minimum bedrooms',
  targetBudget: 'Target budget', keyword: 'Description keyword',
};

/** Strings allow unfinished edits; only a valid submission becomes numeric API parameters. */
export function validateFilters(draft: FilterDraft, page = 1, pageSize = 10): { params: SearchParams; errors: FilterErrors } {
  const params: SearchParams = { page, pageSize };
  const errors: FilterErrors = {};
  for (const key of ['minPrice', 'maxPrice', 'minBedrooms', 'targetBudget'] as const) {
    const raw = draft[key].trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) errors[key] = `${filterLabels[key]} must be a number.`;
    else if (key === 'targetBudget' && value <= 0) errors[key] = 'Target budget must be greater than zero.';
    else if (value < 0) errors[key] = `${filterLabels[key]} must be zero or greater.`;
    else if (key === 'minBedrooms' && !Number.isInteger(value)) errors[key] = 'Minimum bedrooms must be a whole number.';
    else params[key] = value;
  }
  if (params.minPrice !== undefined && params.maxPrice !== undefined && params.minPrice > params.maxPrice) {
    errors.maxPrice = 'Maximum price must be at least the minimum price.';
  }
  for (const key of ['city', 'keyword'] as const) {
    if (draft[key].trim()) params[key] = draft[key].trim();
  }
  for (const key of ['page', 'pageSize'] as const) {
    if (!Number.isInteger(params[key]) || params[key] < 1) errors[key] = `${key === 'page' ? 'Page' : 'Page size'} must be a positive whole number.`;
  }
  return { params, errors };
}
