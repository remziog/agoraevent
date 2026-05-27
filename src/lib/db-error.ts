// Map raw Supabase/PostgREST errors to safe, generic client-facing messages.
// The full error is logged server-side; the client only sees a generic string
// so internal table/column/constraint names are never leaked.
export function dbError(error: unknown, fallback = "Request failed"): Error {
  // eslint-disable-next-line no-console
  console.error("[db error]", error);
  return new Error(fallback);
}
