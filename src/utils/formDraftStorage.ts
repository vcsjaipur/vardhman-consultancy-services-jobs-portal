export function loadFormDraft<T>(storageKey: string): Partial<T> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Partial<T>;
  } catch {
    return null;
  }
}

export function saveFormDraft<T extends Record<string, unknown>>(
  storageKey: string,
  draft: T
): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Ignore storage quota or private-mode access errors
  }
}

export function clearFormDraft(storageKey: string): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage access errors
  }
}
