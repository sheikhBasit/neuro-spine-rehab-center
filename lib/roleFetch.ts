// Tags every same-origin /api/ request from this tab with which role's
// session cookie to use. Needed because each role gets its own cookie
// (see lib/auth.ts) so multiple roles can be logged in at once in
// different tabs of the same browser without kicking each other out.
export function installRoleFetch(role: string) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { __roleFetchRole?: string; __roleFetchOrig?: typeof fetch }
  if (w.__roleFetchRole === role) return
  if (!w.__roleFetchOrig) w.__roleFetchOrig = window.fetch.bind(window)
  const orig = w.__roleFetchOrig

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.startsWith('/api/')) {
      init = { ...(init || {}), headers: { ...(init?.headers || {}), 'X-Session-Role': role } }
    }
    return orig(input, init)
  }) as typeof fetch

  w.__roleFetchRole = role
}
