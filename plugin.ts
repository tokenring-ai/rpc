import type { TokenRingPlugin } from "@tokenring-ai/app";
import appRPC from "@tokenring-ai/app/rpc/app";
import configRPC from "@tokenring-ai/app/rpc/config";

import packageJSON from "./package.json" with { type: "json" };
import RpcService from "./RpcService.ts";

export default {
  name: packageJSON.name,
  displayName: "RPC Layer",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app) {
    const rpcService = app.addService(new RpcService());
    rpcService.registerEndpoint(appRPC);
    rpcService.registerEndpoint(configRPC);
  },
} satisfies TokenRingPlugin;
