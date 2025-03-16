import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { type RawConfig, deepMerge, isRawConfig } from "../src/index.js";

describe("isRawConfig", () => {
    it("should return true for objects", () => {
        const value = { key: "value" };
        assert.equal(isRawConfig(value), true);
    });

    it("should return false for arrays", () => {
        const value = ["value"];
        assert.equal(isRawConfig(value), false);
    });

    it("should return false for null", () => {
        const value = null;
        assert.equal(isRawConfig(value), false);
    });

    it("should return false for non-objects", () => {
        assert.equal(isRawConfig("string"), false);
        assert.equal(isRawConfig(123), false);
        assert.equal(isRawConfig(true), false);
    });
});

describe("deepMerge", () => {
    it("should merge objects deeply", () => {
        const source: RawConfig = { a: 1, b: { c: 2 } };
        const target: RawConfig = { b: { d: 3 }, e: 4 };

        deepMerge(source, target);

        assert.deepEqual(source, { a: 1, b: { c: 2, d: 3 }, e: 4 });
    });

    it("should override arrays in source with arrays in target", () => {
        const source: RawConfig = { a: [1, 2], b: { c: 2 } };
        const target: RawConfig = { a: [3, 4], b: { d: 3 } };

        deepMerge(source, target);

        assert.deepEqual(source, { a: [3, 4], b: { c: 2, d: 3 } });
    });

    it("should replace primitives directly", () => {
        const source: RawConfig = { a: 1, b: { c: 2 } };
        const target: RawConfig = { a: 3, b: { d: 4 } };

        deepMerge(source, target);

        assert.deepEqual(source, { a: 3, b: { c: 2, d: 4 } });
    });

    it("should handle empty target", () => {
        const source: RawConfig = { a: 1, b: { c: 2 } };
        const target: RawConfig = {};

        deepMerge(source, target);

        assert.deepEqual(source, { a: 1, b: { c: 2 } });
    });

    it("should handle empty source", () => {
        const source: RawConfig = {};
        const target: RawConfig = { a: 1, b: { c: 2 } };

        deepMerge(source, target);

        assert.deepEqual(source, { a: 1, b: { c: 2 } });
    });
});
