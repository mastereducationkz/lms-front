/**
 * «Материалы урока» — upload queue scheduling (§8.1: "Uploads run up to 3 at a time"). Kept
 * pure and separate from `AddMaterialMenu` so the concurrency rule has a test that needs
 * neither a DOM nor a real network call.
 */

/**
 * Runs `run` for every item in `tasks`, at most `concurrency` at a time. `run` is expected to
 * report its own outcome through whatever state update the caller closes over; a rejection is
 * swallowed here as a last resort so one file's bug can never wedge the rest of the queue.
 * Resolves once every task has settled, in no particular order.
 */
export async function runWithConcurrency<T>(
  tasks: readonly T[],
  concurrency: number,
  run: (task: T, index: number) => Promise<void>,
): Promise<void> {
  if (!tasks.length) return;
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, tasks.length));
  const workers = Array.from({ length: limit }, async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        await run(tasks[index], index);
      } catch {
        // The caller is expected to catch its own errors and record them in its own state;
        // this only guards against a bug there stopping the remaining queue.
      }
    }
  });
  await Promise.all(workers);
}
