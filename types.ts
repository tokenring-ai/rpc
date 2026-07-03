import type TokenRingApp from "@tokenring-ai/app";
import { z, ZodType, ZodUnknown } from "zod";

export const SuccessSchema = z.object({
  status: z.literal("success"),
});
export type SuccessResult = z.infer<typeof SuccessSchema>;

export const ProviderNotFoundSchema = z.object({
  status: z.literal("providerNotFound"),
});
export type ProviderNotFound = z.infer<typeof ProviderNotFoundSchema>;

export const AgentNotFoundSchema = z.object({
  status: z.literal("agentNotFound"),
});
export type AgentNotFound = z.infer<typeof AgentNotFoundSchema>;

export type RPCImplementation<T extends RPCSchema> = {
  [P in keyof T["methods"]]: T["methods"][P]["type"] extends "stream"
    ? (args: z.output<T["methods"][P]["input"]>, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<z.input<T["methods"][P]["result"]>>
    : (args: z.output<T["methods"][P]["input"]>, app: TokenRingApp) => Promise<z.input<T["methods"][P]["result"]>> | z.input<T["methods"][P]["result"]>;
};
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
};
export type RpcMethod<InputSchema extends z.ZodObject<any>, ResultSchema extends ZodType | ZodUnknown, Type extends "query" | "mutation" | "stream"> = {
  type: Type;
  inputSchema: InputSchema;
  resultSchema: ResultSchema;
  execute: Type extends "stream"
    ? (args: z.output<InputSchema>, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<z.input<ResultSchema>>
    : (args: z.output<InputSchema>, app: TokenRingApp) => z.input<ResultSchema>;
};
export type RpcEndpoint = {
  readonly name: string;
  path: string;
  methods: Record<string, RpcMethod<any, any, any>>;
};
export type ResultOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = z.output<T["methods"][K]["result"]>;
export type ParamsOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = z.input<T["methods"][K]["input"]>;
export type FunctionTypeOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = T["methods"][K]["type"] extends "stream"
  ? (params: ParamsOfRPCCall<T, K>, signal: AbortSignal) => AsyncGenerator<ResultOfRPCCall<T, K>>
  : (params: ParamsOfRPCCall<T, K>) => Promise<ResultOfRPCCall<T, K>>;
