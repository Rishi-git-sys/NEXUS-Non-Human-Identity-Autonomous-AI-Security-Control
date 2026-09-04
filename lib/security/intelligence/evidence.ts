/**
 * Strict evidence sanitizer for NEXUS Security Intelligence Findings.
 * Ensures no secrets, keys, credentials, or sensitive headers are ever emitted in findings.
 */

const SENSITIVE_KEY_PATTERN =
  /(secret|token|password|credential|private_key|privatekey|authorization|auth_header|bearer|signature|cookie|access_key_id|accesskeyid|client_secret|clientsecret|refresh_token|refreshtoken)/i;

const SENSITIVE_VALUE_PATTERN =
  /(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~+/-]+)/i;

/**
 * Recursively sanitizes any data structure by omitting forbidden keys
 * and redacting secret-like string values.
 */
export function sanitizeEvidence(raw: unknown, depth = 0): Record<string, unknown> {
  if (depth > 8 || typeof raw !== 'object' || raw === null) {
    return {};
  }

  if (Array.isArray(raw)) {
    return {
      items: raw.slice(0, 20).map((item) => sanitizeValue(item, depth + 1)),
    };
  }

  const sanitized: Record<string, unknown> = {};
  const entries = Object.entries(raw as Record<string, unknown>);

  for (const [key, value] of entries) {
    // 1. Omit any property whose key name matches sensitive keywords
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      continue;
    }

    // 2. Recursively sanitize safe keys
    sanitized[key] = sanitizeValue(value, depth + 1);
  }

  return sanitized;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    if (SENSITIVE_VALUE_PATTERN.test(value)) {
      return '[REDACTED]';
    }
    // Truncate excessively long strings
    return value.length > 500 ? value.substring(0, 497) + '...' : value;
  }

  if (Array.isArray(value)) {
    if (depth > 8) return [];
    return value.slice(0, 25).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    if (depth > 8) return {};
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        continue;
      }
      sanitizedObj[k] = sanitizeValue(v, depth + 1);
    }
    return sanitizedObj;
  }

  return String(value);
}
