import {TokenRingPlugin} from "@tokenring-ai/app";
import {z} from "zod";

import packageJSON from "./package.json" with {type: "json"};
import RpcService from "./RpcService.ts";

const packageConfigSchema = z.object({});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.addServices(new RpcService());
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
