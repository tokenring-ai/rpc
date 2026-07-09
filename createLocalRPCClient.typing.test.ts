import type TokenRingApp from "@tokenring-ai/app";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createRPCEndpoint } from "./createRPCEndpoint.ts";
import createLocalRPCClient from "./createLocalRPCClient.ts";
import type { RPCSchema } from "./types.ts";

const schema = {
  name: "local-client-test",
  path: "local-client-test",
  methods: {
    echo: {
      type: "query" as const,
      input: z.object({ msg: z.string() }),
      result: z.object({ echoed: z.string() }),
    },
    counter: {
      type: "stream" as const,
      input: z.object({ from: z.number() }),
      result: z.object({ n: z.number() }),
    },
  },
} satisfies RPCSchema;

const endpoint = createRPCEndpoint(schema, {
  async echo(args) {
    return { echoed: args.msg };
  },
  async *counter(args, _app, _signal) {
    for (let i = args.from; i < args.from + 3; i++) yield { n: i };
  },
});

describe("createLocalRPCClient inference", () => {
  it("infers T from the endpoint and exposes per-method client functions", async () => {
    const dummy = {} as TokenRingApp;

    // No explicit <T>: inferred from the typed endpoint.
    const client = createLocalRPCClient(endpoint, dummy);

    // query -> Promise<{ echoed: string }>
    const r = await client.echo({ msg: "hi" });
    const _precise: { echoed: string } = r;
    expect(_precise.echoed).toBe("hi");

    // stream -> AsyncGenerator<{ n: number }>
    const gen = client.counter({ from: 5 }, new AbortController().signal);
    const first = (await gen.next()).value;
    const _preciseYield: { n: number } | undefined = first;
    expect(_preciseYield?.n).toBe(5);
  });

  it("rejects wrong params at compile time", () => {
    const dummy = {} as TokenRingApp;
    const client = createLocalRPCClient(endpoint, dummy);

    // @ts-expect-error - missing required `msg`
    client.echo({});
    // @ts-expect-error - wrong type for `msg`
    client.echo({ msg: 5 });
    // @ts-expect-error - stream method requires a signal
    client.counter({ from: 0 });

    expect(true).toBe(true);
  });
});
