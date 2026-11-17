import { setTimeout as delay } from "node:timers/promises";
import type TokenRingApp from "@tokenring-ai/app";
import type { TokenRingService } from "@tokenring-ai/app/types";
import deepEqual from "@tokenring-ai/utility/object/deepEqual";

export type CreatePollingQueryStreamOptions<Args, Result> = {
  /** `signal` aborts when the client unsubscribes; a slow poll may pass it on to cancel its work. */
  poll: (args: Args, app: TokenRingApp, signal: AbortSignal) => Promise<Result> | Result;
  equals?: (a: Result, b: Result) => boolean;
  intervalMs?: number;
  /** Label for logged poll failures. */
  name?: string;
};

const defaultEquals = (a: unknown, b: unknown) => deepEqual(a, b);

/** Resolves when `signal` aborts, so a poll that ignores the signal cannot hold the stream open. */
function aborted(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

/**
 * A stream that re-runs `poll` every `intervalMs` and yields when the result changes. A poll
 * that throws is logged and retried on the next interval; subscribers keep the last value they
 * received rather than the stream ending.
 */
export function createPollingQueryStream<Args, Result>(opts: CreatePollingQueryStreamOptions<Args, Result>) {
  const equals = opts.equals ?? defaultEquals;
  const intervalMs = opts.intervalMs ?? 2000;
  const logAs: TokenRingService = { name: opts.name ?? "PollingQueryStream", description: "RPC polling stream" };

  return async function* (args: Args, app: TokenRingApp, signal: AbortSignal): AsyncGenerator<Result> {
    let last: Result | undefined;
    let consecutiveFailures = 0;
    const abortedPromise = aborted(signal);
    // A function so the checks below re-read the signal after each await.
    const isAborted = () => signal.aborted;

    while (!isAborted()) {
      let polled: { data: Result } | undefined;
      try {
        polled = (await Promise.race([Promise.resolve(opts.poll(args, app, signal)).then(data => ({ data })), abortedPromise])) ?? undefined;
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        // Log the first failure of a run, not one line per interval while it keeps failing.
        if (consecutiveFailures === 1 && !isAborted()) app.serviceError(logAs, "Poll failed; retrying on the next interval:", error);
      }
      if (isAborted()) return;

      if (polled && (last === undefined || !equals(last, polled.data))) {
        last = polled.data;
        yield polled.data;
      }

      try {
        await delay(intervalMs, null, { signal });
      } catch {
        return;
      }
    }
  };
}
