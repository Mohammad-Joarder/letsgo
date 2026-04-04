/** Supabase Edge: keep work alive after Response (see background-tasks docs). */
export function runInBackground(task: Promise<unknown>): void {
  try {
    const ER = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
      .EdgeRuntime;
    if (ER?.waitUntil) {
      ER.waitUntil(task.catch((e) => console.error("[background]", e)));
      return;
    }
  } catch {
    /* non-edge test env */
  }
  void task.catch((e) => console.error("[background]", e));
}
