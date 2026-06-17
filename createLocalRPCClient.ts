import type TokenRingApp from "@tokenring-ai/app";
import type { FunctionTypeOfRPCCall, RpcEndpoint, RpcMethod, RPCSchema } from "./types.ts";

/**
 * Creates an RPC client that calls the endpoint methods directly in-process.
 * Useful for tests or when the UI and Backend run in the same process.
 */
export default function createLocalRPCClient<T extends RPCSchema>(endpoint: RpcEndpoint, app: TokenRingApp) {
  return Object.fromEntries(
    Object.keys(endpoint.methods).map(name => {
      const method = endpoint.methods[name];

      return [
        name,
        method.type === "stream"
          ? async function* (params: Record<string, unknown>, signal: AbortSignal) {
            // Direct call to the generator function
            const generator = (method as RpcMethod<typeof method.inputSchema, typeof method.resultSchema, "stream">).execute(params, app, signal);
            for await (const value of generator) {
              if (signal?.aborted) break;
              yield value;
            }
          }
          : async (params: any) => {
            // Direct call to the query/mutation function
            return await method.execute(params, app, undefined as any);
          },
      ];
    }),
  ) as {
    [K in keyof T["methods"]]: FunctionTypeOfRPCCall<T, K>;
  };
}
