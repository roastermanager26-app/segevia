/** Obtiene el mensaje devuelto por una Supabase Edge Function no exitosa. */
export async function functionErrorMessage(error: unknown, fallback: string) {
  const context =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : null;

  if (context instanceof Response) {
    const body = (await context
      .clone()
      .json()
      .catch(() => null)) as { error?: string } | null;
    if (body?.error) return body.error;
  }

  return error instanceof Error ? error.message : fallback;
}
