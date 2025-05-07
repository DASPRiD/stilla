import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { z } from "zod";
import { PathMap } from "../src/paths.js";

describe("PathMap", () => {
    it("should extract paths and types from an object schema", () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
            active: z.boolean(),
        });
        const paths = new PathMap(schema);

        assert.equal(paths.get("name"), "string");
        assert.equal(paths.get("age"), "number");
        assert.equal(paths.get("active"), "boolean");
    });

    it("should iterate over paths", () => {
        const schema = z.object({
            name: z.string(),
            age: z.number(),
            active: z.boolean(),
        });
        const paths = new PathMap(schema);
        const result = [];

        for (const [path, typeHint] of paths) {
            result.push(`${path}:${typeHint}`);
        }

        assert.deepEqual(result, ["name:string", "age:number", "active:boolean"]);
    });

    it("should return null for non existent path", () => {
        const paths = new PathMap(z.object({}));

        assert.equal(paths.get("name"), null);
    });

    it("should extract paths from an array schema", () => {
        const schema = z.array(z.string());
        const paths = new PathMap(schema);

        assert.equal(paths.get(".#"), "string");
    });

    it("should handle primitive union types", () => {
        const schema = z.union([z.string().nullable(), z.string().optional()]);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle enums", () => {
        const schema = z.enum(["a", "b", "c"]);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle single literals", () => {
        const schema = z.literal("foo");
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle multi literals", () => {
        const schema = z.literal(["foo", "bar"]);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should throw on mixed literals", () => {
        const schema = z.literal(["foo", 1, BigInt(1), true]);

        assert.throws(() => new PathMap(schema), /Literals with mixed types are not supported/);
    });

    it("should ignore empty-ish literal", () => {
        const schema = z.literal([null, undefined]);
        const paths = new PathMap(schema);

        assert.equal(paths.size, 0);
    });

    it("should handle nullish", () => {
        const schema = z.string().nullish();
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle template literals", () => {
        const schema = z.templateLiteral(["foo", "bar"]);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle native enums", () => {
        enum NativeEnum {
            foo = "foo",
            bar = "bar",
            baz = 5,
        }

        const schema = z.enum(NativeEnum);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle transform schema", () => {
        const schema = z.string().transform((value) => value);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle type with JSON schema fallback", () => {
        const createTransform = (type: string) => {
            const schema = z.transform(() => "bar");
            schema._zod.toJSONSchema = () => ({
                type,
            });
            return schema;
        };

        const schema = z.object({
            string: createTransform("string"),
            number: createTransform("number"),
            boolean: createTransform("boolean"),
        });

        const paths = new PathMap(schema);

        assert.equal(paths.get("string"), "string");
        assert.equal(paths.get("number"), "number");
        assert.equal(paths.get("boolean"), "boolean");
    });

    it("should ignore empty-ish union", () => {
        const schema = z.union([z.null(), z.undefined(), z.never()]);
        const paths = new PathMap(schema);

        assert.equal(paths.size, 0);
    });

    it("should detect path/type collisions when union mixes object and primitive", () => {
        const unionSchema = z.union([z.object({}), z.string()]);

        try {
            new PathMap(unionSchema);
            assert.fail("Expected collision error");
        } catch (error) {
            assert(error instanceof Error);
            assert.equal(error.message, "Union at path '' mixes objects and primitives");
        }
    });

    it("should detect primitive union collisions with different types at the same path", () => {
        const unionSchema = z.union([z.string(), z.number()]);

        try {
            new PathMap(unionSchema);
            assert.fail("Expected collision error");
        } catch (error) {
            assert(error instanceof Error);
            assert.equal(error.message, "Union at path '' mixes primitives of different types");
        }
    });

    it("should detect object union collisions with different types at the same path", () => {
        const unionSchema = z.union([z.object({ foo: z.string() }), z.object({ foo: z.number() })]);

        try {
            new PathMap(unionSchema);
            assert.fail("Expected collision error");
        } catch (error) {
            assert(error instanceof Error);
            assert.equal(
                error.message,
                "Collision detected at path 'foo': type 'string' vs 'number'",
            );
        }
    });

    it("should not detect collisions for identical types", () => {
        new PathMap(z.union([z.object({ foo: z.string() }), z.object({ foo: z.string() })]));
    });
});
