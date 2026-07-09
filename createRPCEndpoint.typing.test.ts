import type TokenRingApp from "@tokenring-ai/app";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createRPCEndpoint } from "./createRPCEndpoint.ts";
import type { RPCSchema, TypedRpcEndpoint } from "./types.ts";

const schema = {
  name: "typing-test",
  path: "typing-test",
  methods: {
    addOne: {
      type: "query" as const,
      input: z.object({ n: z.number() }),
      result: z.object({ doubled: z.number() }),
    },
    ticks: {
      type: "stream" as const,
      input: z.object({}),
      result: z.object({ tick: z.number() }),
    },
  },
} satisfies RPCSchema;

const endpoint = createRPCEndpoint(schema, {
  async addOne(args) {
    return { doubled: args.n * 2 };
  },
  async *ticks(_args, _app, signal) {
    for (let i = 0; i < 3 && !signal.aborted; i++) yield { tick: i };
  },
});

describe("createRPCEndpoint per-method typing", () => {
  it("exposes a precise key->method map (not a string-indexed union)", async () => {
    const dummy = {} as TokenRingApp;

    const result = await endpoint.methods.addOne.execute({ n: 21 }, dummy);
    const _isPreciseResult: { doubled: number } = result;
    expect(_isPreciseResult.doubled).toBe(42);

    const gen = endpoint.methods.ticks.execute({}, dummy, new AbortController().signal);
    const first = (await gen.next()).value;
    const _isPreciseYield: { tick: number } | undefined = first;
    expect(_isPreciseYield?.tick).toBe(0);

    const _endpointIsTyped: TypedRpcEndpoint<typeof schema> = endpoint;
    expect(_endpointIsTyped).toBe(endpoint);
  });

  it("rejects wrong-shaped args at compile time", () => {
    const dummy = {} as TokenRingApp;

    // @ts-expect-error - missing required `n`
    endpoint.methods.addOne.execute({}, dummy);
    // @ts-expect-error - wrong type for `n`
    endpoint.methods.addOne.execute({ n: "no" }, dummy);
    // @ts-expect-error - query method is not a stream (no signal arg)
    endpoint.methods.addOne.execute({ n: 1 }, dummy, new AbortController().signal);
    // @ts-expect-error - stream method requires a signal
    endpoint.methods.ticks.execute({}, dummy);

    expect(true).toBe(true);
  });
});
