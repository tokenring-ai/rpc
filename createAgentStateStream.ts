import { AgentManager } from "@tokenring-ai/agent";
import type { AgentStateSlice } from "@tokenring-ai/agent/types";
import type TokenRingApp from "@tokenring-ai/app";

export type AgentStateStreamYield<Projection> = { status: "agentNotFound" } | { status: "success"; data: Projection; revision: number };

export type StateSubscribable<Slice> = {
  subscribeStateAsync<T extends Slice>(ClassType: new (...args: any[]) => T, signal: AbortSignal): AsyncGenerator<T, void, unknown>;
};

export type CreateAgentStateSliceStreamOptions<Slice, Projection> = {
  SliceClass: new (...args: any[]) => Slice;
  project: (state: Slice) => Projection;
  equals?: (a: Projection, b: Projection) => boolean;
};

export function createAgentStateSliceStream<Slice extends AgentStateSlice<any>, Result>(
  opts: CreateAgentStateSliceStreamOptions<Slice, Result>,
): (args: { agentId: string }, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<Result | { status: "agentNotFound" }> {
  return async function* (args, app, signal) {
    const agent = app.requireService(AgentManager).getAgent(args.agentId);
    if (!agent) {
      yield { status: "agentNotFound" };
      return;
    }

    let last: Result | undefined;

    for await (const slice of agent.subscribeStateAsync(opts.SliceClass, signal)) {
      const data = opts.project(slice);
      if (last !== undefined && opts.equals?.(last, data)) {
        continue;
      }
      last = data;
      yield data;
    }
  };
}
