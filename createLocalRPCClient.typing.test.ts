import { describe, expect, it } from "bun:test";
import type TokenRingApp from "@tokenring-ai/app";
import { z } from "zod";
import createLocalRPCClient from "./createLocalRPCClient.ts";
import { createRPCEndpoint } from "./createRPCEndpoint.ts";
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

    if (false) {
      // @ts-expect-error - missing required `msg`
      void client.echo({});
      // @ts-expect-error - wrong type for `msg`
      void client.echo({ msg: 5 });
      // @ts-expect-error - stream method requires a signal
      client.counter({ from: 0 });
    }

    expect(true).toBe(true);
  });

  it("rejects invalid input at runtime", async () => {
    const dummy = {} as TokenRingApp;
    const client = createLocalRPCClient(endpoint, dummy);

    await expect(client.echo({ msg: 5 } as never)).rejects.toThrow();
  });

  it("rejects invalid results at runtime", async () => {
    const dummy = {} as TokenRingApp;
    const badEndpoint = createRPCEndpoint(schema, {
      async echo() {
        return { echoed: 1 } as never;
      },
      async *counter() {
        yield { n: "nope" } as never;
      },
    });
    const client = createLocalRPCClient(badEndpoint, dummy);

    await expect(client.echo({ msg: "hi" })).rejects.toThrow();

    const gen = client.counter({ from: 0 }, new AbortController().signal);
    await expect(gen.next()).rejects.toThrow();
  });
});
