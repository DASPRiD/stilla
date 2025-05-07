import { strict as assert } from "node:assert";
import { afterEach, before, beforeEach, describe, it, mock } from "node:test";
import { fs, vol } from "memfs";
import { z } from "zod/v4";
import type { FileConfigProvider, ReadConfigContext } from "../../src/index.js";

describe("FileConfigProvider", () => {
    let provider: FileConfigProvider;
    let context: ReadConfigContext;

    before(async () => {
        mock.module("node:fs/promises", {
            defaultExport: fs.promises,
            namedExports: {
                constants: fs.promises.constants,
                access: fs.promises.access,
                readFile: fs.promises.readFile,
            },
        });

        const { FileConfigProvider, PathMap } = await import("../../src/index.js");

        provider = new FileConfigProvider({ basePath: "/mocked/config/path" });
        context = { paths: new PathMap(z.object({})), env: "test" };
    });

    beforeEach(() => {
        vol.fromJSON({
            "/mocked/config/path/default.json": JSON.stringify({ key1: "value1" }),
            "/mocked/config/path/test.yaml": "key2: value2",
            "/mocked/config/path/local.json5": '{key2: "value3"}',
            "/mocked/config/path/local-test.toml": 'key2 = "value4"',
        });
    });

    afterEach(() => {
        vol.reset();
    });

    it("should locate and read configuration files", async () => {
        const result = await provider.read(context);

        assert.deepEqual(result, { key1: "value1", key2: "value4" });
    });

    it("should throw an error if loader does not return an object", async () => {
        vol.fromJSON({
            "/mocked/config/path/test.yaml": "invalid",
        });

        await assert.rejects(async () => {
            await provider.read(context);
        }, new Error("Loader did not return an object for /mocked/config/path/test.yaml"));
    });

    it("should default to load from config folder in CWD", async () => {
        mock.method(process, "cwd", () => "/my-cwd");

        const { FileConfigProvider } = await import("../../src/index.js");
        const provider = new FileConfigProvider();

        vol.fromJSON({
            "/my-cwd/config/test.json": JSON.stringify({ key1: "value1" }),
        });

        const result = await provider.read(context);
        assert.deepEqual(result, { key1: "value1" });
    });
});
