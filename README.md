# @tokenring-ai/rpc

## Overview

Provides a centralized RPC service with a TypedRegistry for managing RPC endpoints. This package enables plugins to register RPC endpoints with type-safe schemas and implementations, supporting queries, mutations, and streaming methods.

## Installation

```bash
bun install @tokenring-ai/rpc
```

## Features

- **Centralized Registry**: TypedRegistry for managing RPC endpoints
- **Type-Safe**: Full TypeScript with Zod validation
- **Method Types**: Support for queries, mutations, and streaming methods
- **Schema-First**: Define schemas and implementations separately with createRPCEndpoint
- **Plugin Integration**: Easy integration with web-host and other services

## Core Components

### RpcService

Main service that manages RPC endpoints using a TypedRegistry.

```typescript
export default class RpcService implements TokenRingService {
  name = "RpcService";
  description = "RPC endpoint registry and execution service";

  registerEndpoint(name: string, endpoint: RpcEndpoint): void;
  getEndpoint(name: string): RpcEndpoint | undefined;
  getAllEndpoints(): RpcEndpoint[];
}
```

### Types

```typescript
export type RpcMethod<InputSchema, ResultSchema, Type> = {
  type: Type; // "query" | "mutation" | "stream"
  inputSchema: InputSchema;
  resultSchema: ResultSchema;
  execute: Type extends "stream"
    ? (args: z.infer<InputSchema>, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<z.infer<ResultSchema>>
    : (args: z.infer<InputSchema>, app: TokenRingApp) => z.infer<ResultSchema>;
};

export type RpcEndpoint = {
  name: string;
  path: string;
  methods: Record<string, RpcMethod<any, any, any>>;
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
```

### createRPCEndpoint

Helper function to create type-safe RPC endpoints from schemas and implementations.

```typescript
function createRPCEndpoint<T extends RPCSchema>(
  schemas: T,
  implementation: RPCImplementation<T>
): RpcEndpoint;
```

## Usage Examples

### Basic Setup

```typescript
import RpcService from '@tokenring-ai/rpc';

const rpcService = new RpcService();
app.addServices(rpcService);
```

### Registering an Endpoint

```typescript
import {z} from 'zod';
import {createRPCEndpoint} from '@tokenring-ai/rpc/createRPCEndpoint';

// Define schemas
const myServiceSchemas = {
  name: "My Service",
  path: '/rpc/myservice',
  methods: {
    greet: {
      type: 'query' as const,
      input: z.object({ name: z.string() }),
      result: z.object({ message: z.string() })
    },
    updateUser: {
      type: 'mutation' as const,
      input: z.object({ id: z.string(), name: z.string() }),
      result: z.object({ success: z.boolean() })
    },
    streamLogs: {
      type: 'stream' as const,
      input: z.object({ count: z.number() }),
      result: z.object({ log: z.string() })
    }
  }
};

// Define implementation
const myServiceImpl = {
  greet: async (args, app) => {
    return { message: `Hello, ${args.name}!` };
  },
  updateUser: async (args, app) => {
    // Update logic here
    return { success: true };
  },
  streamLogs: async function* (args, app, signal) {
    for (let i = 0; i < args.count; i++) {
      if (signal.aborted) break;
      yield { log: `Log entry ${i}` };
    }
  }
};

// Create and register endpoint
const myEndpoint = createRPCEndpoint(myServiceSchemas, myServiceImpl);
rpcService.registerEndpoint('myservice', myEndpoint);
```

### Calling RPC Methods

```typescript
// Get endpoint and call method directly
const endpoint = rpcService.getEndpoint('myservice');
if (endpoint) {
  const result = await endpoint.methods.greet.execute(
    { name: 'World' },
    app
  );
  console.log(result.message); // "Hello, World!"
}

// Stream example
const streamMethod = endpoint.methods.streamLogs;
if (streamMethod.type === 'stream') {
  const controller = new AbortController();
  for await (const item of streamMethod.execute(
    { count: 5 },
    app,
    controller.signal
  )) {
    console.log(item.log);
  }
}
```

### Integration with Web Host

```typescript
import {WebHostService} from '@tokenring-ai/web-host';
import JsonRpcResource from '@tokenring-ai/web-host/JsonRpcResource';

app.waitForService(WebHostService, webHostService => {
  const endpoint = rpcService.getEndpoint('myservice');
  if (endpoint) {
    webHostService.registerResource(
      'My Service RPC',
      new JsonRpcResource(app, endpoint)
    );
  }
});
```

### Plugin Integration

```typescript
import {TokenRingPlugin} from '@tokenring-ai/app';
import RpcService from '@tokenring-ai/rpc';
import {createRPCEndpoint} from '@tokenring-ai/rpc/createRPCEndpoint';
import {z} from 'zod';

export default {
  name: '@my/plugin',
  version: '1.0.0',
  install(app, config) {
    app.waitForService(RpcService, rpcService => {
      const schemas = {
        name: "My Plugin",
        path: '/rpc/myplugin',
        methods: {
          ping: {
            type: 'query' as const,
            input: z.object({}),
            result: z.object({ pong: z.boolean() })
          }
        }
      };
      
      const impl = {
        ping: async (args, app) => ({ pong: true })
      };
      
      const endpoint = createRPCEndpoint(schemas, impl);
      rpcService.registerEndpoint('myplugin', endpoint);
    });
  }
} satisfies TokenRingPlugin;
```

## Dependencies

- `@tokenring-ai/app`: Base application framework
- `@tokenring-ai/utility`: Shared utilities (TypedRegistry)
- `zod`: Schema validation

## License

MIT License - see [LICENSE](./LICENSE) file for details.
