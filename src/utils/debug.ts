/**
 * Diagnostic logging for development builds. Vite replaces this flag at build
 * time, so production bundles omit all console output from {@link debugLog}.
 */
const DEBUG = import.meta.env.DEV;

const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'auth',
  'bearer',
  'jwt',
  'cobalt',
]);

/** True when a string looks like a bearer token or a JWT. */
function looksSecret(value: string): boolean {
  return (
    /^bearer\s+\S/i.test(value) ||
    /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(value)
  );
}

/**
 * Redact anything that looks like a secret before it reaches the console: any
 * value under a sensitive key, and any bearer-token / JWT-shaped string. Guards
 * against the auth token ever being logged by accident.
 */
export function redactForLog(value: unknown, keyIsSensitive = false): unknown {
  if (typeof value === 'string') {
    return keyIsSensitive || looksSecret(value)
      ? `[redacted len=${value.length}]`
      : value;
  }
  if (Array.isArray(value)) return value.map((entry) => redactForLog(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        redactForLog(val, SENSITIVE_KEYS.has(key.toLowerCase())),
      ]),
    );
  }
  return value;
}

/** Log a namespaced diagnostic message when {@link DEBUG} is enabled. */
export function debugLog(scope: string, message: string, data?: unknown): void {
  if (!DEBUG) return;
  if (data === undefined) {
    console.log(`[EDB ${scope}] ${message}`);
  } else {
    console.log(`[EDB ${scope}] ${message}`, redactForLog(data));
  }
}
