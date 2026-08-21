function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map(sanitizeValue)
      .filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nested]) => [key, sanitizeValue(nested)] as const)
        .filter(([, nested]) => nested !== undefined)
    );
  }
  return value;
}

/** Remove somente `undefined`, preservando null, Date, Timestamp e FieldValue. */
export function sanitizeFirestoreData<T>(value: T): T {
  return sanitizeValue(value) as T;
}
