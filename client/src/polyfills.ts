/**
 * iOS Safari Polyfills
 * Fixes compatibility issues with iOS Safari < 15.4
 * Must be imported FIRST before any other code
 */

// ── Array.prototype.at() — iOS Safari 15.4+ ──────────────────────────────────
if (!Array.prototype.at) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.at = function (index: number) {
    const len = this.length;
    const relativeIndex = index < 0 ? len + index : index;
    return relativeIndex >= 0 && relativeIndex < len ? this[relativeIndex] : undefined;
  };
}

// ── String.prototype.at() — iOS Safari 15.4+ ─────────────────────────────────
if (!String.prototype.at) {
  // eslint-disable-next-line no-extend-native
  (String.prototype as any).at = function (index: number) {
    const len = this.length;
    const relativeIndex = index < 0 ? len + index : index;
    return relativeIndex >= 0 && relativeIndex < len ? this[relativeIndex] : undefined;
  };
}

// ── Object.hasOwn() — iOS Safari 15.4+ ───────────────────────────────────────
if (!Object.hasOwn) {
  Object.hasOwn = function (obj: object, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  };
}

// ── structuredClone() — iOS Safari 15.4+ ─────────────────────────────────────
if (typeof structuredClone === 'undefined') {
  (window as any).structuredClone = function <T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  };
}

// ── Array.prototype.findLast() — iOS Safari 15.4+ ────────────────────────────
if (!Array.prototype.findLast) {
  // eslint-disable-next-line no-extend-native
  (Array.prototype as any).findLast = function <T>(
    predicate: (value: T, index: number, array: T[]) => boolean
  ): T | undefined {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this[i], i, this)) return this[i];
    }
    return undefined;
  };
}

// ── Array.prototype.findLastIndex() — iOS Safari 15.4+ ───────────────────────
if (!Array.prototype.findLastIndex) {
  // eslint-disable-next-line no-extend-native
  (Array.prototype as any).findLastIndex = function <T>(
    predicate: (value: T, index: number, array: T[]) => boolean
  ): number {
    for (let i = this.length - 1; i >= 0; i--) {
      if (predicate(this[i], i, this)) return i;
    }
    return -1;
  };
}

export {};
