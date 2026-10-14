import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAdminResponse } from './read-response';

describe('admin infrastructure response recovery', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('keeps successful documents and known recovery codes', async () => {
    await expect(readAdminResponse(Response.json({ entries: [] }))).resolves.toEqual({ entries: [] });
    for (const code of ['forbidden', 'revision_conflict', 'upload_incomplete', 'upload_expired']) {
      await expect(readAdminResponse(Response.json({ error: { code } }, { status: 409 })))
        .resolves.toEqual({ error: { code } });
    }
  });

  it('reports HTML failure status and a safe reference without leaking its body', async () => {
    const response = new Response('<html>private provider details</html>', {
      status: 500, headers: { 'CF-Ray': 'a3d9cfc85b0b0b21-SIN', 'X-Nib-Atlas-Release': 'a'.repeat(40) },
    });
    await expect(readAdminResponse(response, true)).rejects.toThrow(
      'The server returned an unreadable response (HTTP 500). Your last action may have completed. Reload the saved state before retrying. Reference: a3d9cfc85b0b0b21-SIN.',
    );
    expect(JSON.parse(vi.mocked(console.warn).mock.calls[0]![0])).toEqual({
      event: 'admin_response_failure', status: 500, reference: 'a3d9cfc85b0b0b21-SIN', release: 'a'.repeat(40),
    });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('private provider');
  });

  it.each(['', '<html>login page</html>', '{broken', 'null', '[]', '"secret"'])('rejects invalid success body %s', async body => {
    await expect(readAdminResponse(new Response(body))).rejects.toThrow('HTTP 200');
  });

  it('uses an app request ID and discards unsafe diagnostic headers', async () => {
    const requestId = '61000000-0000-4000-8000-000000000001';
    await expect(readAdminResponse(new Response('bad', { status: 502, headers: {
      'CF-Ray': '<script>secret</script>', 'X-Admin-Request-Id': requestId, 'X-Nib-Atlas-Release': 'private-details',
    } }))).rejects.toThrow(`Reference: ${requestId}`);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/script|private-details/);
  });

  it('normalizes malformed errors and never returns provider text as a code', async () => {
    for (const body of [{}, {error: null}, {error: {code: '<html>secret</html>'}}]) {
      await expect(readAdminResponse(Response.json(body, {status: 503}))).resolves.toMatchObject({error: {code: 'service_unavailable'}});
    }
  });

  it('preserves cancellation without logging a false infrastructure failure', async () => {
    const response = new Response();
    const error = new DOMException('Aborted', 'AbortError');
    vi.spyOn(response, 'json').mockRejectedValue(error);
    await expect(readAdminResponse(response)).rejects.toBe(error);
    expect(console.warn).not.toHaveBeenCalled();
  });
});
