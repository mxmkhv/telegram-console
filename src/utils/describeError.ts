// The underlying reason, for showing next to "what failed" in a notice.
export function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
