/** Public camelCase contract from backend/app/models.py and schemas.py. */
export interface SearchParams {
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  city?: string;
  keyword?: string;
  targetBudget?: number;
  page: number;
  pageSize: number;
}

export interface Listing {
  id: string; source: string; address: string; city: string; state: string; zip: string;
  price: number; bedrooms: number; bathrooms: number; sqft: number;
  latitude: number; longitude: number; listedDate: string;
  status: 'active' | 'pending' | 'sold'; description: string; relevanceScore: number;
}

export interface SearchResponse {
  items: Listing[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class SearchApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isListing(value: unknown): value is Listing {
  if (!isRecord(value)) return false;
  const strings = ['id', 'source', 'address', 'city', 'state', 'zip', 'description', 'listedDate'];
  const numbers = ['price', 'bedrooms', 'bathrooms', 'sqft', 'latitude', 'longitude', 'relevanceScore'];
  return strings.every(key => typeof value[key] === 'string') &&
    numbers.every(key => typeof value[key] === 'number' && Number.isFinite(value[key])) &&
    (value.status === 'active' || value.status === 'pending' || value.status === 'sold');
}

function isSearchResponse(data: unknown): data is SearchResponse {
  return isRecord(data) && Array.isArray(data.items) && data.items.every(isListing) &&
    ['totalCount', 'page', 'pageSize', 'totalPages'].every(key =>
      typeof data[key] === 'number' && Number.isInteger(data[key]) &&
      data[key] >= (key === 'page' || key === 'pageSize' ? 1 : 0));
}

/** Encode only supported fields, retaining zero while omitting blank optional text. */
export function buildSearchQuery(params: SearchParams): string {
  const query = new URLSearchParams();
  const keys = ['minPrice', 'maxPrice', 'minBedrooms', 'city', 'keyword', 'targetBudget', 'page', 'pageSize'] as const;
  for (const key of keys) {
    const value = params[key];
    if (value !== undefined && String(value).trim() !== '') query.set(key, String(value).trim());
  }
  return query.toString();
}

/** Interpret FastAPI's 422 detail array without displaying input values or server internals. */
function validationMessage(data: unknown): string {
  if (!isRecord(data) || !Array.isArray(data.detail)) return 'Please check your search filters and try again.';
  const messages = data.detail.filter(isRecord).map(detail => {
    const location = Array.isArray(detail.loc) ? detail.loc.filter(part => part !== 'query').join('.') : '';
    return typeof detail.msg === 'string' ? `${location ? `${location}: ` : ''}${detail.msg}` : '';
  }).filter(Boolean);
  return messages.join(' · ') || 'Please check your search filters and try again.';
}

/** Validate untrusted JSON before exposing it to React; cancellation is owned by the caller. */
export async function getListings(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(`/api/listings?${buildSearchQuery(params)}`, { signal });
  if (!response.ok) {
    if (response.status === 422) {
      const data: unknown = await response.json().catch(() => null);
      throw new SearchApiError(validationMessage(data), 422);
    }
    throw new SearchApiError('Search is unavailable right now. Please try again.', response.status);
  }
  const data: unknown = await response.json();
  if (!isSearchResponse(data)) throw new Error('Invalid search response');
  return data;
}
