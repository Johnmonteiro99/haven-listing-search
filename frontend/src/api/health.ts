import { apiUrl } from './config';

export interface HealthResponse {
  status: string;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(apiUrl('/api/health'), { signal });
  if (!response.ok) {
    throw new Error(`Health request failed (${response.status})`);
  }
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null ||
      !('status' in data) || typeof data.status !== 'string') {
    throw new Error('Invalid health response');
  }
  return { status: data.status };
}
