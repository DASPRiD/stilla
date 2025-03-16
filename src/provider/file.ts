import assert from "node:assert";
import { constants, access, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { parse as Json5Parse } from "json5";
import type { parse as TomlParse } from "smol-toml";
import type { parse as YamlParse } from "yaml";
import { deepMerge, isRawConfig } from "../helpers.js";
import type { ConfigProvider, RawConfig, ReadConfigContext } from "./index.js";

export type FileConfigProviderOptions = {
    basePath?: string;
};

export class FileConfigProvider implements ConfigProvider {
    private readonly options: FileConfigProviderOptions;

    public constructor(options: FileConfigProviderOptions = {}) {
        this.options = options;
    }

    public async read(context: ReadConfigContext): Promise<RawConfig> {
        const paths = await this.locateFiles(context.env);
        const rawConfig: RawConfig = {};

        for (const path of paths) {
            const loader = this.getLoader(path);
            const data = await loader.load(path);

            if (!isRawConfig(data)) {
                throw new Error(`Loader did not return an object for ${path}`);
            }

            deepMerge(rawConfig, data);
        }

        return rawConfig;
    }

    private getLoader(path: string): Loader {
        const extension = extname(path).substring(1);

        for (const loader of loaders) {
            if (loader.extensions.includes(extension)) {
                return loader;
            }
        }

        /* node:coverage ignore next */
        assert.fail(`No loader found for .${extension}`);
    }

    private getAllowedFileNames(env: string): string[] {
        const allowedBaseNames = ["default", env, "local", `local-${env}`];
        const allowedFileNames = [];

        for (const baseName of allowedBaseNames) {
            for (const extension of allowedExtensions) {
                allowedFileNames.push(`${baseName}.${extension}`);
            }
        }

        return allowedFileNames;
    }

    private async locateFiles(env: string): Promise<string[]> {
        const paths = [];
        const allowedFileNames = this.getAllowedFileNames(env);
        const basePath = this.options.basePath ?? `${process.cwd()}/config`;

        for (const fileName of allowedFileNames) {
            const path = join(basePath, fileName);

            try {
                await access(path, constants.F_OK);
                paths.push(path);
            } catch {
                // No-op, file not found
            }
        }

        return paths;
    }
}

type Loader = {
    extensions: string[];
    load: (path: string) => Promise<unknown>;
};

const loaders: Loader[] = [
    /* node:coverage disable */
    {
        extensions: ["js", "ts"],
        load: async (path: string): Promise<unknown> => {
            return (await import(path)).default;
        },
    },
    /* node:coverage enable */
    {
        extensions: ["json"],
        load: async (path: string): Promise<unknown> => {
            const data = await readFile(path, { encoding: "utf8" });
            return JSON.parse(data);
        },
    },
    {
        extensions: ["yaml", "yml"],
        load: async (path: string): Promise<unknown> => {
            let parse: typeof YamlParse;

            /* node:coverage disable */
            try {
                parse = (await import("yaml")).parse;
            } catch {
                throw new Error("YAML parser missing, install `yaml` dependency");
            }
            /* node:coverage enable */

            const data = await readFile(path, { encoding: "utf8" });
            return parse(data);
        },
    },
    {
        extensions: ["toml"],
        load: async (path: string): Promise<unknown> => {
            let parse: typeof TomlParse;

            /* node:coverage disable */
            try {
                parse = (await import("smol-toml")).parse;
            } catch {
                throw new Error("TOML parser missing, install `smol-toml` dependency");
            }
            /* node:coverage enable */

            const data = await readFile(path, { encoding: "utf8" });
            return parse(data);
        },
    },
    {
        extensions: ["json5"],
        load: async (path: string): Promise<unknown> => {
            let parse: typeof Json5Parse;

            /* node:coverage disable */
            try {
                parse = (await import("json5")).default.parse;
            } catch {
                throw new Error("JSON5 parser missing, install `json5` dependency");
            }
            /* node:coverage enable */

            const data = await readFile(path, { encoding: "utf8" });
            return parse(data);
        },
    },
];

const allowedExtensions = loaders.reduce<string[]>((extensions, loader) => {
    extensions.push(...loader.extensions);
    return extensions;
}, []);
