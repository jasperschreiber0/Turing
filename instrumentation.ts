export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js 22+ ships a built-in localStorage global as a native stub object
    // whose methods cannot be added via defineProperties. Next.js dev overlay
    // checks `typeof localStorage !== 'undefined'` (which passes) then calls
    // localStorage.getItem() (which is not a function on the stub), causing a
    // 500 on every SSR route. Replace the entire global with an in-memory shim.
    if (
      typeof globalThis.localStorage !== 'undefined' &&
      typeof (globalThis.localStorage as Storage).getItem !== 'function'
    ) {
      const store: Record<string, string> = {}
      ;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
        getItem:    (k: string) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
        setItem:    (k: string, v: string) => { store[k] = String(v) },
        removeItem: (k: string) => { delete store[k] },
        clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
        key:        (i: number) => Object.keys(store)[i] ?? null,
        get length() { return Object.keys(store).length },
      }
    }
  }
}
