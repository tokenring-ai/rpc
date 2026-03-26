import createTestingApp from "@tokenring-ai/app/test/createTestingApp";
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {createRPCEndpoint} from './createRPCEndpoint.ts';
import {RPCImplementation, RPCSchema} from './types.ts';

describe('createRPCEndpoint', () => {
  let mockApp: any;
  let schemas: RPCSchema;
  let implementation: RPCImplementation<typeof schemas>;

  beforeEach(() => {
    mockApp = createTestingApp();

    schemas = {
      name: "Example RPC",
      path: '/api/rpc',
      methods: {
        testQuery: {
          type: 'query' as const,
          input: z.object({ message: z.string() }),
          result: z.object({ response: z.string() })
        },
        testMutation: {
          type: 'mutation' as const,
          input: z.object({ value: z.number() }),
          result: z.object({ doubled: z.number() })
        },
        testStream: {
          type: 'stream' as const,
          input: z.object({ count: z.number() }),
          result: z.object({ number: z.number() })
        }
      }
    };

    // Initialize implementation with mock functions
    implementation = {
      testQuery: vi.fn(async (args: any, app: any) => {
        return { response: `Received: ${args.message}` };
      }),
      testMutation: vi.fn(async (args: any, app: any) => {
        return { doubled: args.value * 2 };
      }),
      testStream: vi.fn(async function* (args: any, app: any, signal: AbortSignal) {
        for (let i = 0; i < args.count; i++) {
          if (signal?.aborted) break;
          yield { number: i };
        }
      })
    } as RPCImplementation<typeof schemas>;
  });

  it('should create endpoint with correct path', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    expect(endpoint.path).toBe('/api/rpc');
  });

  it('should convert query method', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    expect(endpoint.methods.testQuery.type).toBe('query');
    expect(endpoint.methods.testQuery.inputSchema).toEqual(schemas.methods.testQuery.input);
    expect(endpoint.methods.testQuery.resultSchema).toEqual(schemas.methods.testQuery.result);
    expect(endpoint.methods.testQuery.execute).toBe(implementation.testQuery);
  });

  it('should convert mutation method', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    expect(endpoint.methods.testMutation.type).toBe('mutation');
    expect(endpoint.methods.testMutation.inputSchema).toEqual(schemas.methods.testMutation.input);
    expect(endpoint.methods.testMutation.resultSchema).toEqual(schemas.methods.testMutation.result);
    expect(endpoint.methods.testMutation.execute).toBe(implementation.testMutation);
  });

  it('should convert stream method', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    expect(endpoint.methods.testStream.type).toBe('stream');
    expect(endpoint.methods.testStream.inputSchema).toEqual(schemas.methods.testStream.input);
    expect(endpoint.methods.testStream.resultSchema).toEqual(schemas.methods.testStream.result);
    expect(endpoint.methods.testStream.execute).toBe(implementation.testStream);
  });

  it('should handle empty methods', () => {
    const emptySchemas: RPCSchema = {
      name: "Example RPC",
      path: '/api/empty',
      methods: {}
    };

    const emptyImplementation: RPCImplementation<typeof emptySchemas> = {};
    
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
    
    expect(result).toEqual({ response: 'Received: world' });
    expect(implementation.testQuery).toHaveBeenCalledWith({ message: 'world' }, mockApp);
  });

  it('should handle single method', () => {
    const singleMethodSchemas: RPCSchema = {
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

    const singleMethodImplementation: RPCImplementation<typeof singleMethodSchemas> = {
      ping: async (args: any, app: any) => ({ pong: true })
    };
    
    const endpoint = createRPCEndpoint(singleMethodSchemas, singleMethodImplementation);
    
    expect(endpoint.path).toBe('/api/single');
    expect(Object.keys(endpoint.methods)).toHaveLength(1);
    expect(endpoint.methods.ping).toBeDefined();
  });

  it('should handle mixed method types', () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    const methods = endpoint.methods;
    
    expect(methods.testQuery.type).toBe('query');
    expect(methods.testMutation.type).toBe('mutation');
    expect(methods.testStream.type).toBe('stream');
  });

  it('should execute mutation method correctly', async () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    const result = await endpoint.methods.testMutation.execute(
      { value: 5 },
      mockApp
    );
    
    expect(result).toEqual({ doubled: 10 });
    expect(implementation.testMutation).toHaveBeenCalledWith({ value: 5 }, mockApp);
  });

  it('should handle stream method execution', async () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    const results: any[] = [];
    const controller = new AbortController();
    
    for await (const item of endpoint.methods.testStream.execute(
      { count: 3 },
      mockApp,
      controller.signal
    )) {
      results.push(item);
    }
    
    expect(results).toEqual([{ number: 0 }, { number: 1 }, { number: 2 }]);
  });

  it('should handle stream abortion', async () => {
    const endpoint = createRPCEndpoint(schemas, implementation);
    
    const results: any[] = [];
    const controller = new AbortController();
    
    // Create a custom implementation that checks abort signal
    const abortImpl: RPCImplementation<typeof schemas> = {
      testQuery: async () => ({ response: 'test' }),
      testMutation: async () => ({ doubled: 0 }),
      testStream: async function* (_args: any, _app: any, signal: AbortSignal) {
        for (let i = 0; i < 100; i++) {
          if (signal?.aborted) break;
          yield { number: i };
          // Small delay to allow abort to happen
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
    };
    
    const abortEndpoint = createRPCEndpoint(schemas, abortImpl);
    
    // Start streaming
    const streamPromise = (async () => {
      for await (const item of abortEndpoint.methods.testStream.execute(
        { count: 100 },
        mockApp,
        controller.signal
      )) {
        results.push(item);
      }
    })();
    
    // Abort after a few items
    setTimeout(() => controller.abort(), 10);
    
    await streamPromise;
    
    // Should have some results before abort (at least 0, less than 100)
    expect(results.length).toBeGreaterThanOrEqual(0);
    expect(results.length).toBeLessThan(100);
  });
});
