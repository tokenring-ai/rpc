import TokenRingApp from "@tokenring-ai/app";
import {z} from "zod";

export type RPCImplementation<T extends RPCSchema> = {
  [P in keyof T["methods"]]: T["methods"][P]["type"] extends "stream"
    ? (args: z.infer<T["methods"][P]["input"]>, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<z.infer<T["methods"][P]["result"]>>
    : (args: z.infer<T["methods"][P]["input"]>, app: TokenRingApp) => Promise<z.infer<T["methods"][P]["result"]>> | z.infer<T["methods"][P]["result"]>;
}
export type RPCSchema = {
  name: string;
  path: string;
  methods: {
    [method: string]: {
      type: "query" | "mutation" | "stream";
      input: z.ZodSchema;
      result: z.ZodSchema;
    };
  };
}
export type RpcMethod<InputSchema extends z.ZodObject<any>, ResultSchema extends z.ZodTypeAny, Type extends "query" | "mutation" | "stream"> = {
  type: Type;
  inputSchema: InputSchema;
  resultSchema: ResultSchema;
  execute: Type extends "stream"
    ? (args: z.infer<InputSchema>, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<z.infer<ResultSchema>>
    : (args: z.infer<InputSchema>, app: TokenRingApp) => z.infer<ResultSchema>;
};
export type RpcEndpoint = {
  readonly name: string;
  path: string;
  methods: Record<string, RpcMethod<any, any, any>>;
}
export type ResultOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = z.infer<T["methods"][K]["result"]>;
export type ParamsOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = z.infer<T["methods"][K]["input"]>;
export type FunctionTypeOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = T["methods"][K]["type"] extends "stream"
  ? (params: ParamsOfRPCCall<T, K>, signal: AbortSignal) => AsyncGenerator<ResultOfRPCCall<T, K>>
  : (params: ParamsOfRPCCall<T, K>) => Promise<ResultOfRPCCall<T, K>>;