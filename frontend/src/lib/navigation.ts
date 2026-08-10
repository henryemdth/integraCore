// Router-agnostic navigation for code outside the React tree (e.g. the axios
// 401 interceptor). The router registers its `useNavigate` once via
// `setNavigateFn`; until then a best-effort full reload is used.
let navigateFn: ((path: string) => void) | null = null

export function setNavigateFn(fn: (path: string) => void): void {
  navigateFn = fn
}

export function navigate(path: string): void {
  if (navigateFn) {
    navigateFn(path)
  } else {
    window.location.assign(path)
  }
}

export function goToLogin(): void {
  navigate("/login")
}
