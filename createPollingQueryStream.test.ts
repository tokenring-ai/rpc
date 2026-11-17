import { describe, expect, it, spyOn } from "bun:test";
import createTestingApp from "@tokenring-ai/app/test/createTestingApp.test";
import { createPollingQueryStream } from "./createPollingQueryStream.ts";

describe("createPollingQueryStream", () => {
  it("yields only when polled data changes", async () => {
    let value = 0;
    const stream = createPollingQueryStream({
      intervalMs: 10,
      poll: () => value,
    });

    const app = createTestingApp();
    const controller = new AbortController();
    const generator = stream({}, app, controller.signal);

    const first = await generator.next();
    expect(first.value).toBe(0);

    value = 1;
    const second = await generator.next();
    expect(second.value).toBe(1);

    controller.abort();
    await generator.return(undefined);
  });

  it("logs a failed poll and keeps streaming on the next interval", async () => {
    let calls = 0;
    const stream = createPollingQueryStream({
      intervalMs: 5,
      poll: () => {
        calls++;
        if (calls === 2 || calls === 3) throw new Error("upstream down");
        return calls === 1 ? "a" : "b";
      },
    });
    const app = createTestingApp();
    const errors = spyOn(app, "serviceError").mockImplementation(() => {});
    const controller = new AbortController();
    const generator = stream({}, app, controller.signal);

    expect((await generator.next()).value).toBe("a");
    expect((await generator.next()).value).toBe("b");
    expect(calls).toBe(4);
    // Two failures in a row are logged once.
    expect(errors).toHaveBeenCalledTimes(1);

    controller.abort();
    await generator.return(undefined);
  });

  it("ends promptly when aborted during a slow poll, and passes the signal to poll", async () => {
    let seenSignal: AbortSignal | undefined;
    const stream = createPollingQueryStream({
      intervalMs: 5,
      poll: (_args, _app, signal) => {
        seenSignal = signal;
        return new Promise<number>(() => {});
      },
    });
    const controller = new AbortController();
    const generator = stream({}, createTestingApp(), controller.signal);

    const pending = generator.next();
    await Bun.sleep(5);
    controller.abort();
    expect(await pending).toEqual({ done: true, value: undefined });
    expect(seenSignal).toBe(controller.signal);
  });
});
