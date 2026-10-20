import { getAuthHeaders } from '@/app/lib/api';

/** fetch() for the workflow-builder API routes: adds the portal Bearer token. */
export function wfFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, headers: { ...getAuthHeaders(), ...init.headers } });
}
