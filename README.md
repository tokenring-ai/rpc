# @tokenring-ai/rpc

## Overview

The RPC (Remote Procedure Call) service provides a centralized, type-safe mechanism for registering and executing remote procedures within the Token Ring ecosystem. This package enables plugins to register RPC endpoints with type-safe schemas and implementations, supporting queries, mutations, and streaming methods through a KeyedRegistry-based architecture.

## Key Features

- **Centralized Registry**: KeyedRegistry for managing RPC endpoints with type safety
- **Type-Safe Operations**: Full TypeScript support with Zod schema validation
- **Three Method Types**:
  - **Query**: Read-only operations that return a single value
  - **Mutation**: State-changing operations that modify data
  - **Stream**: Asynchronous generators for real-time data streams
- **Schema-First Design**: Separate schema definitions from implementation logic
- **Local Client**: `createLocalRPCClient` for direct in-process endpoint calls
- **Plugin Integration**: Seamless integration with web-host and other services
- **Abort Support**: Stream methods support abort signals for cancellation

## Installation

```bash
bun add @tokenring-ai/rpc
```

## Core Components

### RpcService

The main service that manages RPC endpoints using a KeyedRegistry. Implements the `TokenRingService` interface.

**Class Signature:**
```typescript
export default class RpcService implements TokenRingService {
  readonly name: string;
  readonly description: string;
  
  getEndpoint: (name: string) => RpcEndpoint | undefined;
  getAllEndpoints: () => RpcEndpoint[];
  
  registerEndpoint(endpoint: RpcEndpoint): void;
}
```

**Properties:**
- `name`: Service identifier ("RpcService")
- `description`: Service description ("RPC endpoint registry and execution service")

**Methods:**
- `getEndpoint(name: string)`: Retrieves an endpoint by name
- `getAllEndpoints()`: Returns all registered endpoints
- `registerEndpoint(endpoint: RpcEndpoint)`: Registers a new endpoint

**Usage:**
```typescript
import RpcService from '@tokenring-ai/rpc';

// Create and register the service
const rpcService = new RpcService();
app.addServices(rpcService);

// Register endpoints
rpcService.registerEndpoint(endpoint);

// Get endpoint by name
const endpoint = rpcService.getEndpoint('myservice');

// Get all registered endpoints
const allEndpoints = rpcService.getAllEndpoints();
```

### createRPCEndpoint

Helper function to create type-safe RPC endpoints from schemas and implementations.

**Function Signature:**
```typescript
export function createRPCEndpoint<T extends RPCSchema>(
  schemas: T,
  implementation: RPCImplementation<T>
): RpcEndpoint;
```

**Parameters:**
- `schemas`: RPCSchema defining the endpoint structure
- `implementation`: RPCImplementation with method implementations

**Returns:**
- `RpcEndpoint`: Type-safe endpoint with all methods bound

**Usage:**
```typescript
import {createRPCEndpoint} from '@tokenring-ai/rpc/createRPCEndpoint';
import {z} from 'zod';

const endpoint = createRPCEndpoint(schemas, implementation);
```

### createLocalRPCClient

Creates an RPC client that calls endpoint methods directly in-process. Useful for tests or when the UI and Backend run in the same process.

**Function Signature:**
```typescript
export default function createLocalRPCClient<T extends RPCSchema>(
  endpoint: RpcEndpoint,
  app: TokenRingApp
): {
  [K in keyof T["methods"]]: FunctionTypeOfRPCCall<T, K>;
};
```

**Parameters:**
- `endpoint`: The RPC endpoint to create a client for
- `app`: TokenRingApp instance for method execution

**Returns:**
- Object with methods matching the endpoint's schema

**Usage:**
```typescript
import createLocalRPCClient from '@tokenring-ai/rpc/createLocalRPCClient';

const endpoint = rpcService.getEndpoint('myservice');
if (endpoint) {
  const client = createLocalRPCClient(endpoint, app);
  
  // Call methods directly on the client
  const result = await client.greet({ name: 'World' });
  console.log(result.message); // "Hello, World!"
  
  // For streaming methods
  const controller = new AbortController();
  for await (const item of client.streamLogs({ count: 5 }, controller.signal)) {
    console.log(item.log);
  }
}
```

## Types

The package provides several TypeScript types for defining and implementing RPC endpoints.

### RPCSchema

Defines the structure of an RPC endpoint including its name, path, and method schemas.

```typescript
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
```

### RPCImplementation

Defines the function signatures for each method implementation based on the method type.

```typescript
export type RPCImplementation<T extends RPCSchema> = {
  [P in keyof T["methods"]]: T["methods"][P]["type"] extends "stream"
    ? (args: z.infer<T["methods"][P]["input"]>, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<z.infer<T["methods"][P]["result"]>>
    : (args: z.infer<T["methods"][P]["input"]>, app: TokenRingApp) => Promise<z.infer<T["methods"][P]["result"]>> | z.infer<T["methods"][P]["result"]>;
}
```

### RpcMethod

Represents a single method within an endpoint.

```typescript
export type RpcMethod<InputSchema extends z.ZodObject<any>, ResultSchema extends z.ZodTypeAny, Type extends "query" | "mutation" | "stream"> = {
  type: Type;
  inputSchema: InputSchema;
  resultSchema: ResultSchema;
  execute: Type extends "stream"
    ? (args: z.infer<InputSchema>, app: TokenRingApp, signal: AbortSignal) => AsyncGenerator<z.infer<ResultSchema>>
    : (args: z.infer<InputSchema>, app: TokenRingApp) => z.infer<ResultSchema>;
};
```

### RpcEndpoint

Represents a complete RPC endpoint with all its methods.

```typescript
export type RpcEndpoint = {
  readonly name: string;
  path: string;
  methods: Record<string, RpcMethod<any, any, any>>;
}
```

### Helper Types

Additional type aliases for working with RPC calls:

```typescript
// Extract result type for a method
export type ResultOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = z.infer<T["methods"][K]["result"]>;

// Extract parameter type for a method
export type ParamsOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = z.infer<T["methods"][K]["input"]>;

// Extract function type for a method (handles both async and streaming)
export type FunctionTypeOfRPCCall<T extends RPCSchema, K extends keyof T["methods"]> = T["methods"][K]["type"] extends "stream"
  ? (params: ParamsOfRPCCall<T, K>, signal: AbortSignal) => AsyncGenerator<ResultOfRPCCall<T, K>>
  : (params: ParamsOfRPCCall<T, K>) => Promise<ResultOfRPCCall<T, K>>;
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
import RpcService from '@tokenring-ai/rpc';

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
rpcService.registerEndpoint(myEndpoint);
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

### Using the Local Client

```typescript
import createLocalRPCClient from '@tokenring-ai/rpc/createLocalRPCClient';

const endpoint = rpcService.getEndpoint('myservice');
if (endpoint) {
  const client = createLocalRPCClient(endpoint, app);
  
  // Call methods directly on the client
  const result = await client.greet({ name: 'World' });
  console.log(result.message); // "Hello, World!"
  
  // For streaming methods
  const controller = new AbortController();
  for await (const item of client.streamLogs({ count: 5 }, controller.signal)) {
    console.log(item.log);
  }
}
```

### Integration with Web Host

```typescript
import {WebHostService} from '@tokenring-ai/web-host';
import JsonRpcResource from '@tokenring-ai/web-host/JsonRpcResource';
import RpcService from '@tokenring-ai/rpc';

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
      rpcService.registerEndpoint(endpoint);
    });
  }
} satisfies TokenRingPlugin;
```

## Configuration

The RPC package has a minimal configuration schema with no required options:

```typescript
const packageConfigSchema = z.object({});
```

No configuration is required by default. The plugin automatically:
1. Registers the RpcService with the application
2. Provides the RPC endpoint registry

## Services

### RpcService

**Interface:** `TokenRingService`

**Purpose:** Centralized RPC endpoint registry and execution service

**Registration:**
```typescript
import RpcService from '@tokenring-ai/rpc';

const rpcService = new RpcService();
app.addServices(rpcService);
```

**Or via Plugin:**
```typescript
import {TokenRingPlugin} from '@tokenring-ai/app';
import RpcService from '@tokenring-ai/rpc';

export default {
  name: '@tokenring-ai/rpc',
  install(app, config) {
    app.addServices(new RpcService());
  }
} satisfies TokenRingPlugin;
```

## Error Handling

The RPC package uses standard TypeScript/JavaScript error handling patterns. Methods may throw errors during execution, particularly when:

- **Schema Validation Fails**: Zod schemas validate input and output data. Invalid data will throw validation errors.
- **Method Execution Fails**: Implementation functions may throw errors based on their logic.
- **Stream Aborted**: Streaming methods check the abort signal and may stop yielding values.

**Error Handling Example:**
```typescript
try {
  const endpoint = rpcService.getEndpoint('myservice');
  if (endpoint) {
    const result = await endpoint.methods.greet.execute(
      { name: 'World' },
      app
    );
    console.log(result.message);
  }
} catch (error) {
  console.error('RPC call failed:', error);
  // Handle the error appropriately
}
```

**Stream Cancellation:**
```typescript
const controller = new AbortController();

// Start streaming
const streamPromise = (async () => {
  for await (const item of endpoint.methods.streamLogs.execute(
    { count: 100 },
    app,
    controller.signal
  )) {
    console.log(item.log);
  }
})();

// Cancel after 5 seconds
setTimeout(() => {
  controller.abort();
}, 5000);

await streamPromise; // Will complete when stream is aborted
```

## Integration

The package integrates with:

- **@tokenring-ai/app**: For service registration and app framework integration
- **@tokenring-ai/utility**: For KeyedRegistry implementation
- **@tokenring-ai/web-host**: For HTTP/WebSocket endpoint registration

### Agent System Integration

RPC endpoints can be registered by plugins and accessed by agents through the RpcService:

```typescript
app.waitForService(RpcService, rpcService => {
  // Register endpoint
  const endpoint = createRPCEndpoint(schemas, implementation);
  rpcService.registerEndpoint(endpoint);
  
  // Agents can now access this endpoint
  const retrievedEndpoint = rpcService.getEndpoint('myservice');
});
```

### Service Registration Pattern

```typescript
import RpcService from '@tokenring-ai/rpc';

// Register the service
const rpcService = new RpcService();
app.addServices(rpcService);

// Wait for service to be available
app.waitForService(RpcService, service => {
  // Use the service
  service.registerEndpoint(endpoint);
});
```

## Best Practices

1. **Separate Schemas from Implementation**: Always define your schemas first, then implement the methods separately. This promotes clear separation of concerns.

2. **Use Appropriate Method Types**: Choose the correct method type based on whether the operation is read-only (query), state-changing (mutation), or produces streaming data.

3. **Validate Input and Output**: Always use Zod schemas to validate input and output types, ensuring type safety and preventing runtime errors.

4. **Handle Abort Signals**: For stream methods, properly handle abort signals to allow proper cleanup and resource release.

5. **Use Semantic Names**: Choose clear, descriptive names for endpoints and methods to improve code readability and maintainability.

6. **Document Method Behavior**: Document the expected behavior of each method, including any side effects and error conditions.

7. **Test Edge Cases**: Include tests for edge cases such as empty method lists, single methods, and mixed method types.

8. **Leverage Plugin Pattern**: Use the plugin pattern to register RPC endpoints in a way that integrates cleanly with the Token Ring application lifecycle.

9. **Use Local Client for Tests**: For unit tests where the UI and Backend run in the same process, use `createLocalRPCClient` instead of making actual HTTP calls.

10. **Direct Endpoint Registration**: Always register the complete endpoint object with `registerEndpoint()` method.

## Testing

The package includes comprehensive tests for the `createRPCEndpoint` function using vitest.

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

### Test File Structure

The test file `createRPCEndpoint.test.ts` covers the following scenarios:

```typescript
import createTestingApp from "@tokenring-ai/app/test/createTestingApp";
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {createRPCEndpoint} from './createRPCEndpoint';

describe('createRPCEndpoint', () => {
  let mockApp: any;
  
  beforeEach(() => {
    mockApp = createTestingApp();
  });

  it('should create endpoint with correct path', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    expect(endpoint.path).toBe('/api/rpc');
  });

  it('should convert query method', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    expect(endpoint.methods.testQuery).toEqual({
      type: 'query',
      inputSchema: schemas.methods.testQuery.input,
      resultSchema: schemas.methods.testQuery.result,
      execute: implementation.testQuery
    });
  });

  it('should convert mutation method', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    expect(endpoint.methods.testMutation).toEqual({
      type: 'mutation',
      inputSchema: schemas.methods.testMutation.input,
      resultSchema: schemas.methods.testMutation.result,
      execute: implementation.testMutation
    });
  });

  it('should convert stream method', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    expect(endpoint.methods.testStream).toEqual({
      type: 'stream',
      inputSchema: schemas.methods.testStream.input,
      resultSchema: schemas.methods.testStream.result,
      execute: implementation.testStream
    });
  });

  it('should handle empty methods', () => {
    const emptySchemas = {
      name: "Example RPC",
      path: '/api/empty',
      methods: {}
    };
    const emptyImplementation = {};
    const endpoint = createRPCEndpoint(emptySchemas, emptyImplementation);
    expect(endpoint.path).toBe('/api/empty');
    expect(Object.keys(endpoint.methods)).toHaveLength(0);
  });

  it('should preserve method implementations', async () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    const result = await endpoint.methods.testQuery.execute(
      { message: 'world' },
      mockApp
    );
    expect(result).toBeDefined();
  });

  it('should handle single method', () => {
    const singleMethodSchemas = {
      name: "Single Method RPC",
      path: '/api/single',
      methods: {
        ping: {
          type: 'query' as const,
          input: z.object({}),
          result: z.object({ pong: z.boolean() })
        }
      }
    };
    const singleMethodImplementation = {
      ping: async (args: any, app: any) => ({ pong: true })
    };
    const endpoint = createRPCEndpoint(singleMethodSchemas, singleMethodImplementation);
    expect(endpoint.path).toBe('/api/single');
    expect(Object.keys(endpoint.methods)).toHaveLength(1);
  });

  it('should handle mixed method types', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    const methods = endpoint.methods;
    expect(methods.testQuery.type).toBe('query');
    expect(methods.testMutation.type).toBe('mutation');
    expect(methods.testStream.type).toBe('stream');
  });
});
```

### Test Coverage

The test suite covers:

- Endpoint creation with correct path
- Query method conversion
- Mutation method conversion
- Stream method conversion
- Empty methods handling
- Method implementation preservation
- Single method handling
- Mixed method types

### Writing Tests for Your RPC Endpoints

When creating your own RPC endpoints, follow this testing pattern:

```typescript
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {createRPCEndpoint} from '@tokenring-ai/rpc/createRPCEndpoint';
import createLocalRPCClient from '@tokenring-ai/rpc/createLocalRPCClient';
import createTestingApp from '@tokenring-ai/app/test/createTestingApp';

describe('My RPC Endpoint', () => {
  const schemas = {
    name: "My Service",
    path: '/rpc/myservice',
    methods: {
      greet: {
        type: 'query' as const,
        input: z.object({ name: z.string() }),
        result: z.object({ message: z.string() })
      }
    }
  };

  const implementation = {
    greet: async (args, app) => ({ message: `Hello, ${args.name}!` })
  };

  it('should create endpoint correctly', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    expect(endpoint.name).toBe('My Service');
    expect(endpoint.path).toBe('/rpc/myservice');
  });

  it('should execute method correctly', async () => {
    const app = createTestingApp();
    const client = createLocalRPCClient(
      createRPCEndpoint(schemas, implementation),
      app
    );
    const result = await client.greet({ name: 'World' });
    expect(result.message).toBe('Hello, World!');
  });
});
```

## Dependencies

- **@tokenring-ai/app**: Base application framework and service management (0.2.0)
- **@tokenring-ai/utility**: Shared utilities, including KeyedRegistry (0.2.0)
- **zod**: Schema validation library (^4.3.6)

## Package Exports

The package exports the following:

- `@tokenring-ai/rpc` - Main entry point, exports `RpcService`
- `@tokenring-ai/rpc/createRPCEndpoint` - Create type-safe RPC endpoints
- `@tokenring-ai/rpc/createLocalRPCClient` - Create local RPC client for in-process calls
- `@tokenring-ai/rpc/types` - All type definitions (RPCSchema, RPCImplementation, etc.)

## Related Components

- **@tokenring-ai/app**: Base application framework for service management and plugin architecture
- **@tokenring-ai/web-host**: Provides HTTP/WebSocket endpoints for RPC resources
- **@tokenring-ai/utility**: Shared utilities including KeyedRegistry implementation
- **@tokenring-ai/rpc/createLocalRPCClient**: For direct in-process endpoint calls

## License

MIT License - see [LICENSE](./LICENSE) file for details.
