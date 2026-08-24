import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleSheetsDataService } from './GoogleSheetsDataService';

describe('servicio remoto', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reintenta cuando Apps Script devuelve un error HTTP temporal', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, data: { auth: { token: 'token', expiresAt: 123, role: 'staff' } } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const pending = new GoogleSheetsDataService('https://example.test/exec').authenticate('0000', 'staff');
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toMatchObject({ auth: { role: 'staff' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limita cada intento para no dejar la pantalla bloqueada', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = new GoogleSheetsDataService('https://example.test/exec').getPlayers('token');
    const expectation = expect(pending).rejects.toMatchObject({ code: 'OFFLINE' });
    await vi.runAllTimersAsync();

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
