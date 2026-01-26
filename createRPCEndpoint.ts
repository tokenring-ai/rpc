import type {RpcEndpoint, RPCImplementation, RPCSchema} from "./types.ts";

export function createRPCEndpoint<T extends RPCSchema>(schemas: T, implementation: RPCImplementation<T>) {
  return {
    name: schemas.name,
    path: schemas.path,
    methods: Object.fromEntries(
      Object.entries(schemas.methods)
        .map(([name, method]) =>
          [name,
            {
              type: method.type,
              inputSchema: method.input,
              resultSchema: method.result,
              execute: implementation[name as keyof T["methods"]],
            }
          ]
        )
    )
  } satisfies RpcEndpoint;
}