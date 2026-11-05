/** Browser-tab lease, not a login credential. Resume is only enabled while an
 * exclusive Web Lock proves this account has no other live tab in this browser.
 * sessionStorage may be cloned by Duplicate Tab; storage alone is NOT proof. */
export interface TabLease { resume: string | null; unlock(): void | Promise<void> }
export class MultiplayerConnectionError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
export async function acquireTabLease(owner: string): Promise<TabLease> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return { resume: null, unlock() {} };
  return new Promise((resolve, reject) => {
    const completed = navigator.locks.request(`mconline-multiplayer:${owner}`, { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock) { reject(new MultiplayerConnectionError('To konto ma otwarte połączenie w innej karcie tej przeglądarki. Wróć do niej i wybierz Rozłącz.', 'LOCAL_SESSION_ACTIVE')); return; }
      return new Promise<void>(unlock => {
        let resume: string | null = null;
        try {
          const key = `mconline-mp-resume-v1:${owner}`;
          const stored = sessionStorage.getItem(key);
          resume = stored && /^[a-f0-9]{64}$/.test(stored) ? stored : [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2,'0')).join('');
          sessionStorage.setItem(key, resume);
        } catch { resume = null; } // Login still works; explicit recovery is available.
        resolve({ resume, unlock: async () => { unlock(); await completed; } });
      });
    });
    void completed.catch(reject);
  });
}
