import {TokenRingService} from "@tokenring-ai/app/types";
import KeyedRegistry from "@tokenring-ai/utility/registry/KeyedRegistry";
import TypedRegistry from "@tokenring-ai/utility/registry/TypedRegistry";
import {RpcEndpoint} from "./types.ts";

export default class RpcService implements TokenRingService {
  name = "RpcService";
  description = "RPC endpoint registry and execution service";

  private endpoints = new TypedRegistry<RpcEndpoint>();

  registerEndpoint = this.endpoints.register;
  getEndpoint = this.endpoints.getItemByName;
  getAllEndpoints = this.endpoints.getItems
}
