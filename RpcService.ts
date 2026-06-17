import type { TokenRingService } from "@tokenring-ai/app/types";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import type { RpcEndpoint, RpcMethod } from "./types.ts";

export default class RpcService implements TokenRingService {
  readonly name = "RpcService";
  description = "RPC endpoint registry and execution service";

  private endpoints = new KeyedRegistry<RpcEndpoint>();
  private methodRegistry = new KeyedRegistry<RpcMethod<any, any, any>>();

  getMethod = this.methodRegistry.get;

  getInterface = this.endpoints.get;
  getAllEndpoints = this.endpoints.valuesArray;

  registerEndpoint(endpoint: RpcEndpoint) {
    this.endpoints.set(endpoint.name, endpoint);
    for (const [methodName, method] of Object.entries(endpoint.methods)) {
      this.methodRegistry.set(`${endpoint.path}.${methodName}`, method);
    }
  }
}
