import type { RPCImplementation, RPCSchema, RpcMethod, TypedRpcEndpoint } from "./types.ts";

export function createRPCEndpoint<T extends RPCSchema>(schemas: T, implementation: RPCImplementation<T>): TypedRpcEndpoint<T> {
  const methods = {} as Record<string, RpcMethod<any, any, any>>;
  for (const [name, method] of Object.entries(schemas.methods)) {
    methods[name] = {
      type: method.type,
      inputSchema: method.input,
      resultSchema: method.result,
      execute: implementation[name as keyof T["methods"]],
    };
  }
  return {
    name: schemas.name,
    path: schemas.path,
    methods: methods as TypedRpcEndpoint<T>["methods"],
  };
}
