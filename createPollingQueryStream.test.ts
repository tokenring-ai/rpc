import createTestingApp from "@tokenring-ai/app/test/createTestingApp";
import { describe, expect, it } from "vitest";
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
});