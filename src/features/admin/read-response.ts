import { UUID } from './shop-contract';

/** Do not expose infrastructure HTML, provider bodies or JSON parser excerpts. */
export async function readAdminResponse(response: Response, mutation = false) {
  const ray = response.headers.get('CF-Ray');
  const request = response.headers.get('X-Admin-Request-Id');
  const release = response.headers.get('X-Nib-Atlas-Release');
  const reference = ray && /^[a-f0-9]{16}(?:-[A-Z]{3})?$/i.test(ray) ? ray
    : request && UUID.test(request) ? request : undefined;
  const report = () => console.warn(JSON.stringify({
    event: 'admin_response_failure', status: response.status, reference,
    release: release && /^[a-f0-9]{40}$/.test(release) ? release : undefined,
  }));
  const unreadable = () => {
    report();
    return new Error(`The server returned an unreadable response (HTTP ${response.status}). ${
      mutation
        ? 'Your last action may have completed. Reload the saved state before retrying.'
        : 'Try reloading the saved state.'
    }${reference ? ` Reference: ${reference}.` : ''}`);
  };
  let value;
  try {
    value = await response.json();
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') throw error;
    throw unreadable();
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unreadable();
  if (!response.ok) {
    report();
    // Existing callers map only known codes to product copy and recovery actions.
    // Never forward an arbitrary provider message as a displayed error.
    return { ...value, error: { code: typeof value.error?.code === 'string'
      && /^[a-z_]{1,64}$/.test(value.error.code) ? value.error.code : 'service_unavailable' } };
  }
  return value;
}
