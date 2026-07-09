import type TokenRingApp from "@tokenring-ai/app";
import type { FunctionTypeOfRPCCall, RPCSchema, RpcEndpoint, RpcMethod, TypedRpcEndpoint } from "./types.ts";

/**
 * Creates an RPC client that calls the endpoint methods directly in-process.
 * Useful for tests or when the UI and Backend run in the same process.
 *
 * `T` (the RPC schema) is inferred when a `TypedRpcEndpoint<T>` (i.e. the result
 * of `createRPCEndpoint`) is passed. When the endpoint is retrieved from the
 * runtime registry (`RpcService.getEndpoint`, which returns a loose `RpcEndpoint`),
 * specify `<T>` explicitly so method calls stay type-checked.
 */
export function createLocalRPCClient<T extends RPCSchema>(
  endpoint: TypedRpcEndpoint<T>,
  app: TokenRingApp,
): { [K in keyof T["methods"]]: FunctionTypeOfRPCCall<T, K> };
export function createLocalRPCClient<T extends RPCSchema>(endpoint: RpcEndpoint, app: TokenRingApp): { [K in keyof T["methods"]]: FunctionTypeOfRPCCall<T, K> };
export function createLocalRPCClient<T extends RPCSchema>(endpoint: TypedRpcEndpoint<T> | RpcEndpoint, app: TokenRingApp) {
  return Object.fromEntries(
    Object.entries(endpoint.methods).map(([name, method]) => {
      return [
        name,
        method.type === "stream"
          ? async function* (params: Record<string, unknown>, signal: AbortSignal) {
              // Direct call to the generator function
              const generator = (method as RpcMethod<typeof method.inputSchema, typeof method.resultSchema, "stream">).execute(params, app, signal);
              for await (const value of generator) {
                if (signal.aborted) break;
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

export default createLocalRPCClient;
