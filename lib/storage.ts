/**
 * A robust wrapper for localStorage that handles SecurityErrors (e.g. in Private Mode)
 * and falls back to in-memory storage if localStorage is unavailable.
 */
class SafeStorage {
  private memoryStore: Record<string, string> = {};

  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("localStorage.getItem failed, using memory store", e);
      return this.memoryStore[key] || null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage.setItem failed, using memory store", e);
      this.memoryStore[key] = value;
    }
  }

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn("localStorage.removeItem failed, using memory store", e);
      delete this.memoryStore[key];
    }
  }
}

export const safeStorage = new SafeStorage();
