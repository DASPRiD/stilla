import type { PathMap } from "../paths.js";

export type RawConfig = Record<string, unknown>;

export type ReadConfigContext = {
    paths: PathMap;
    env: string;
};

export type ConfigProvider = {
    read: (context: ReadConfigContext) => Promise<RawConfig>;
};

export { EnvConfigProvider, type EnvConfigProviderOptions } from "./env.js";
export { FileConfigProvider, type FileConfigProviderOptions } from "./file.js";
