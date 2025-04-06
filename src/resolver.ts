import type { z } from "zod";
import { deepMerge } from "./helpers.js";
import { PathMap } from "./paths.js";
import { EnvConfigProvider } from "./provider/env.js";
import { FileConfigProvider } from "./provider/file.js";
import type { ConfigProvider, RawConfig, ReadConfigContext } from "./provider/index.js";

type ProviderItem = {
    provider: ConfigProvider;
    priority: number;
};

export class ConfigResolver<T extends z.ZodTypeAny> {
    private readonly schema: T;
    private readonly pathMap: PathMap;
    private readonly env: string;
    private readonly providers: ProviderItem[] = [];

    public constructor(schema: T, env = process.env.NODE_ENV ?? "development") {
        this.schema = schema;
        this.pathMap = new PathMap(schema);
        this.env = env;
    }

    public addProvider(provider: ConfigProvider, priority: number): void {
        this.providers.push({
            provider,
            priority,
        });
    }

    public static default<T extends z.ZodTypeAny>(schema: T, env?: string): ConfigResolver<T> {
        const resolver = new ConfigResolver(schema, env);

        resolver.addProvider(new FileConfigProvider(), 100);
        resolver.addProvider(new EnvConfigProvider(), 200);

        return resolver;
    }

    public async resolve(): Promise<z.output<T>> {
        const context: ReadConfigContext = {
            paths: this.pathMap,
            env: this.env,
        };

        const rawConfig: RawConfig = {};

        const providers = [...this.providers]
            .sort((a, b) => a.priority - b.priority)
            .map((item) => item.provider);

        for (const provider of providers) {
            const data = await provider.read(context);
            deepMerge(rawConfig, data);
        }

        const parseResult = this.schema.safeParse(rawConfig);

        if (!parseResult.success) {
            throw new Error(`Failed to parse config: ${parseResult.error}`);
        }

        return parseResult.data;
    }
}
