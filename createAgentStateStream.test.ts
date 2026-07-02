import StateManager from "@tokenring-ai/app/StateManager";
import { SerializableStateSlice } from "@tokenring-ai/app/StateManager";
import type TokenRingApp from "@tokenring-ai/app";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createAgentStateStream } from "./createAgentStateStream.ts";

const schema = z.object({ value: z.number() });

class TestSlice extends SerializableStateSlice<typeof schema> {
  value = 0;

  constructor() {
    super("TestSlice", schema);
  }

  serialize() {
    return { value: this.value };
  }

  deserialize(data: z.output<typeof schema>) {
    this.value = data.value;
  }
}

describe("createAgentStateStream", () => {
  let stateManager: StateManager<TestSlice>;
  let mockApp: TokenRingApp;

  beforeEach(() => {
    stateManager = new StateManager<TestSlice>();
    stateManager.initializeState(TestSlice, {});

    mockApp = {
      requireService: () => {
        throw new Error("not used in this test");
      },
    } as unknown as TokenRingApp;
  });

  it("yields agentNotFound when agent is missing", async () => {
    const stream = createAgentStateStream({
      SliceClass: TestSlice,
      project: state => ({ value: state.value }),
      resolveAgent: () => null,
    });

    const controller = new AbortController();
    const chunks = [];
    for await (const chunk of stream({ agentId: "missing" }, mockApp, controller.signal)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ status: "agentNotFound" }]);
  });

  it("deduplicates unchanged projections", async () => {
    const stream = createAgentStateStream({
      SliceClass: TestSlice,
      project: state => ({ value: state.value }),
      resolveAgent: () => ({
        subscribeStateAsync: stateManager.subscribeAsync.bind(stateManager),
      }),
    });

    const controller = new AbortController();
    const iterator = stream({ agentId: "agent-1" }, mockApp, controller.signal);

    expect(await iterator.next()).toEqual({
      done: false,
      value: { status: "success", data: { value: 0 }, revision: 1 },
    });

    stateManager.mutateState(TestSlice, state => {
      state.value = 1;
    });
    expect(await iterator.next()).toEqual({
      done: false,
      value: { status: "success", data: { value: 1 }, revision: 2 },
    });

    stateManager.mutateState(TestSlice, state => {
      state.value = 1;
    });
    const pending = iterator.next();
    await expect(Promise.race([pending, Promise.resolve("timeout")])).resolves.toBe("timeout");

    controller.abort();
    await pending;
  });

  it("cleans up subscription on abort", async () => {
    const stream = createAgentStateStream({
      SliceClass: TestSlice,
      project: state => ({ value: state.value }),
      resolveAgent: () => ({
        subscribeStateAsync: stateManager.subscribeAsync.bind(stateManager),
      }),
    });

    const controller = new AbortController();
    const iterator = stream({ agentId: "agent-1" }, mockApp, controller.signal);
    await iterator.next();

    controller.abort();
    const result = await iterator.next();
    expect(result.done).toBe(true);
  });
});