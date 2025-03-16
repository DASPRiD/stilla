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
        const schema = z.union([z.string(), z.string()]);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle enums", () => {
        const schema = z.enum(["a", "b", "c"]);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle native enums", () => {
        enum NativeEnum {
            foo = "foo",
            bar = "bar",
            baz = 5,
        }

        const schema = z.nativeEnum(NativeEnum);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
    });

    it("should handle effect schemas", () => {
        const schema = z.string().transform((value) => value);
        const paths = new PathMap(schema);

        assert.equal(paths.get(""), "string");
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
