import type {RPCSchema, RpcEndpoint, FunctionTypeOfRPCCall} from "./types.ts";
import TokenRingApp from "@tokenring-ai/app";

/**
 * Creates an RPC client that calls the endpoint methods directly in-process.
 * Useful for tests or when the UI and Backend run in the same process.
 */
export default function createLocalRPCClient<T extends RPCSchema>(
  endpoint: RpcEndpoint,
  app: TokenRingApp
) {
  return Object.fromEntries(
    Object.keys(endpoint.methods).map((name) => {
      const method = endpoint.methods[name];

      return [
        name,
        method.type === "stream"
          ? async function* (params: any, signal: AbortSignal) {
            // Direct call to the generator function
            const generator = method.execute(params, app, signal);
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
    })
  ) as {
    [K in keyof T["methods"]]: FunctionTypeOfRPCCall<T, K>;
  };
}