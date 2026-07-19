import type { TokenRingPlugin } from "@tokenring-ai/app";
import appRPC from "@tokenring-ai/app/rpc/app";
import configRPC from "@tokenring-ai/app/rpc/config";
import { z } from "zod";

import packageJSON from "./package.json" with { type: "json" };
import RpcService from "./RpcService.ts";

const packageConfigSchema = z.object({});

export default {
  name: packageJSON.name,
  displayName: "RPC Layer",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, _config) {
    const rpcService = new RpcService();
    app.addServices(rpcService);
    rpcService.registerEndpoint(appRPC);
    rpcService.registerEndpoint(configRPC);
  },
  config: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
