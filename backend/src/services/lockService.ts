let locked = false;

export function isWriteLocked(): boolean {
  return locked;
}

export function acquireWriteLock(): void {
  locked = true;
}

export function releaseWriteLock(): void {
  locked = false;
}
