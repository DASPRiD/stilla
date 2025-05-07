import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { type ZodRawShape, z } from "zod/v4";
import {
    type ConfigProvider,
    ConfigResolver,
    EnvConfigProvider,
    FileConfigProvider,
    type RawConfig,
} from "../src/index.js";

class MockConfigProvider implements ConfigProvider {
    private readonly data: RawConfig;

    constructor(data: RawConfig) {
        this.data = data;
    }

    read(): Promise<RawConfig> {
        return Promise.resolve(this.data);
    }
}

describe("ConfigResolver", () => {
    let schema: z.ZodObject<ZodRawShape>;
    let resolver: ConfigResolver<typeof schema>;

    beforeEach(() => {
        schema = z.object({
            key1: z.string(),
            key2: z.number(),
            nested: z.object({
                key3: z.boolean(),
            }),
        });

        resolver = new ConfigResolver(schema, "test");
    });

    it("should resolve configuration with default providers", async () => {
        const fileConfig = { key1: "value1" };
        const envConfig = { key2: 42, nested: { key3: true } };

        resolver.addProvider(new MockConfigProvider(fileConfig), 50);
        resolver.addProvider(new MockConfigProvider(envConfig), 100);

        const result = await resolver.resolve();

        assert.deepEqual(result, {
            key1: "value1",
            key2: 42,
            nested: { key3: true },
        });
    });

    it("should prioritize providers correctly", async () => {
        const lowPriorityConfig = { key1: "low", nested: { key3: false } };
        const highPriorityConfig = { key1: "high", key2: 42, nested: { key3: true } };

        resolver.addProvider(new MockConfigProvider(highPriorityConfig), 100);
        resolver.addProvider(new MockConfigProvider(lowPriorityConfig), 50);

        const result = await resolver.resolve();

        assert.deepEqual(result, {
            key1: "high",
            key2: 42,
            nested: { key3: true },
        });
    });

    it("should throw an error if the configuration is invalid", async () => {
        const invalidConfig = { key1: "value1" };

        resolver.addProvider(new MockConfigProvider(invalidConfig), 50);

        await assert.rejects(async () => {
            await resolver.resolve();
        }, Error);
    });

    it("should use default environment if not provided", () => {
        const resolverWithDefaultEnv = new ConfigResolver(schema);
        assert.equal(resolverWithDefaultEnv["env"], "development");
    });

    it("should use provided environment", () => {
        const resolverWithTestEnv = new ConfigResolver(schema, "test");
        assert.equal(resolverWithTestEnv["env"], "test");
    });

    it("should create a default resolver with default providers", () => {
        const defaultResolver = ConfigResolver.default(schema);

        const providers = defaultResolver["providers"];
        assert.equal(providers.length, 2);
        assert.equal(providers[0].priority, 100);
        assert(providers[0].provider instanceof FileConfigProvider);
        assert.equal(providers[1].priority, 200);
        assert(providers[1].provider instanceof EnvConfigProvider);
    });
});
