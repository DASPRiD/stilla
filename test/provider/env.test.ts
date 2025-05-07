import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { z } from "zod";
import { EnvConfigProvider, PathMap, type ReadConfigContext } from "../../src/index.js";

describe("EnvConfigProvider", () => {
    let provider: EnvConfigProvider;
    let context: ReadConfigContext;
    let mockPaths: PathMap;

    beforeEach(() => {
        mockPaths = new PathMap(
            z.object({
                key1: z.string(),
                key2: z.number(),
                nested: z.object({
                    key3: z.boolean(),
                }),
                objectArray: z.array(
                    z.object({
                        key4: z.string(),
                    }),
                ),
                primitiveArray: z.array(z.string()),
                arrayArray: z.array(z.array(z.string())),
                validBigint: z.bigint(),
                invalidBigint: z.bigint(),
            }),
        );
        context = { paths: mockPaths, env: "test" };
    });

    it("should read environment variables with a prefix", async () => {
        provider = new EnvConfigProvider({
            prefix: "APP_",
            variables: {
                APP_KEY1: "value1",
                APP_KEY2: "42",
                APP_NESTED_KEY3: "true",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            key1: "value1",
            key2: 42,
            nested: { key3: true },
        });
    });

    it("should read environment variables without a prefix", async () => {
        provider = new EnvConfigProvider({
            variables: {
                KEY1: "value1",
                KEY2: "42",
                NESTED_KEY3: "true",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            key1: "value1",
            key2: 42,
            nested: { key3: true },
        });
    });

    it("should handle object array indices in environment variable keys", async () => {
        provider = new EnvConfigProvider({
            variables: {
                OBJECT_ARRAY_0_KEY4: "value4",
                OBJECT_ARRAY_1_KEY4: "value5",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            objectArray: [{ key4: "value4" }, { key4: "value5" }],
        });
    });

    it("should handle primitive array indices in environment variable keys", async () => {
        provider = new EnvConfigProvider({
            variables: {
                PRIMITIVE_ARRAY_0: "value4",
                PRIMITIVE_ARRAY_1: "value5",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            primitiveArray: ["value4", "value5"],
        });
    });

    it("should handle array-array indices in environment variable keys", async () => {
        provider = new EnvConfigProvider({
            variables: {
                ARRAY_ARRAY_0_0: "value1",
                ARRAY_ARRAY_0_1: "value2",
                ARRAY_ARRAY_1_0: "value3",
                ARRAY_ARRAY_1_1: "value4",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            arrayArray: [
                ["value1", "value2"],
                ["value3", "value4"],
            ],
        });
    });

    it("should ignore partial array matches", async () => {
        provider = new EnvConfigProvider({
            variables: {
                OBJECT_ARRAY_0_KEY5: "value4",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {});
    });

    it("should ignore environment variables without the required prefix", async () => {
        provider = new EnvConfigProvider({
            prefix: "APP_",
            variables: {
                OTHER_KEY1: "value1",
                APP_KEY2: "42",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            key2: 42,
        });
    });

    it("should ignore environment variables not in the path map", async () => {
        provider = new EnvConfigProvider({
            variables: {
                KEY1: "value1",
                UNKNOWN_KEY: "value2",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            key1: "value1",
        });
    });

    it("should cast values based on type hints", async () => {
        provider = new EnvConfigProvider({
            variables: {
                KEY1: "value1",
                KEY2: "not a number",
                NESTED_KEY3: "false",
                VALID_BIGINT: "12345",
                INVALID_BIGINT: "abc",
            },
        });

        const result = await provider.read(context);

        assert.deepEqual(result, {
            key1: "value1",
            key2: "not a number",
            nested: { key3: false },
            validBigint: BigInt(12345),
            invalidBigint: "abc",
        });
    });
});
