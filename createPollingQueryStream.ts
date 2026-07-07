import { setTimeout as delay } from "node:timers/promises";
import type TokenRingApp from "@tokenring-ai/app";
import { deepEquals } from "bun";

export type CreatePollingQueryStreamOptions<Args, Result> = {
  poll: (args: Args, app: TokenRingApp) => Promise<Result> | Result;
  equals?: (a: Result, b: Result) => boolean;
  intervalMs?: number;
};

const defaultEquals = (a: unknown, b: unknown) => deepEquals(a, b, true);

export function createPollingQueryStream<Args, Result>(opts: CreatePollingQueryStreamOptions<Args, Result>) {
  const equals = opts.equals ?? defaultEquals;
  const intervalMs = opts.intervalMs ?? 2000;

  return async function* (args: Args, app: TokenRingApp, signal: AbortSignal): AsyncGenerator<Result> {
    let last: Result | undefined;

    while (!signal.aborted) {
      const data = await opts.poll(args, app);
      if (last === undefined || !equals(last, data)) {
        last = data;
        yield data;
      }

      try {
        await delay(intervalMs, null, { signal });
      } catch {
        return;
      }
    }
  };
}
