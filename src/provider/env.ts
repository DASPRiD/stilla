import * as changeCase from "change-case";
import type { PathMap, TypeHint } from "../paths.js";
import type { ConfigProvider, RawConfig, ReadConfigContext } from "./index.js";

export type EnvConfigProviderOptions = {
    prefix?: string;
    variables?: Record<string, string>;
};

type PathHint = {
    path: string;
    typeHint: TypeHint;
};

const isNumRegex = /^[0-9]+$/;

export class EnvConfigProvider implements ConfigProvider {
    private readonly options: EnvConfigProviderOptions;

    public constructor(options: EnvConfigProviderOptions = {}) {
        this.options = options;
    }

    public read(context: ReadConfigContext): Promise<RawConfig> {
        const { prefix = "", variables = process.env } = this.options;
        const prefixLength = prefix.length;
        const rawConfig: RawConfig = {};

        for (const [key, value] of Object.entries(variables)) {
            if (value === undefined || (prefix !== "" && !key.startsWith(prefix))) {
                continue;
            }

            const extracted = this.extractPath(key.slice(prefixLength), context.paths);

            if (extracted) {
                const castValue = this.castValue(value, extracted.typeHint);
                this.setNestedValue(rawConfig, extracted.path, castValue);
            }
        }

        return Promise.resolve(rawConfig);
    }

    private extractPath(key: string, paths: PathMap): PathHint | null {
        const normalizedKey = key.replace(/_/g, ".").toLowerCase();

        for (const [name, typeHint] of paths) {
            const normalizedName = name
                .split(".")
                .map((part) => (part === "#" ? "#" : changeCase.noCase(part, { delimiter: "." })))
                .join(".");

            if (normalizedName === normalizedKey) {
                return { path: name, typeHint };
            }

            if (!normalizedName.includes("#")) {
                continue;
            }

            const injected = this.injectArrayIndices(normalizedKey, name, normalizedName);

            if (!injected) {
                continue;
            }

            const [indexedName, indexedNormalizedName] = injected;

            if (indexedNormalizedName === normalizedKey) {
                return { path: indexedName, typeHint };
            }
        }

        return null;
    }

    private injectArrayIndices(
        normalizedKey: string,
        name: string,
        normalizedName: string,
    ): [string, string] | null {
        const indices: string[] = [];
        const searchParts = normalizedName.split(".");
        const keyParts = normalizedKey.split(".");

        if (searchParts.length !== keyParts.length) {
            return null;
        }

        for (const [index, searchPart] of searchParts.entries()) {
            const keyPart = keyParts[index];

            if (searchPart === "#" && isNumRegex.test(keyPart)) {
                indices.push(keyPart);
                searchParts[index] = keyPart;
                continue;
            }

            if (searchPart !== keyPart) {
                return null;
            }
        }

        const indexedNormalizedName = searchParts.join(".");
        let indexedName = name;

        for (const index of indices) {
            indexedName = indexedName.replace("#", index);
        }

        return [indexedName, indexedNormalizedName];
    }

    private castValue(value: string, typeHint: TypeHint): unknown {
        switch (typeHint) {
            case "boolean":
                return value.toLowerCase() === "true" || value === "1";

            case "number": {
                const number = Number(value);
                return Number.isNaN(number) ? value : number;
            }

            case "string": {
                return value;
            }
        }
    }

    private setNestedValue(rawConfig: RawConfig, path: string, value: unknown): void {
        const parts = path.split(".");
        let current: RawConfig | unknown[] = rawConfig;

        for (let i = 0; i < parts.length - 1; i++) {
            current = this.getNextLevel(current, parts[i], parts[i + 1]);
        }

        const lastPart = parts[parts.length - 1];

        if (Array.isArray(current)) {
            current[Number(lastPart)] = value;
            return;
        }

        current[lastPart] = value;
    }

    private getNextLevel(
        current: RawConfig | unknown[],
        currentKey: string,
        nextKey: string,
    ): RawConfig | unknown[] {
        const nextType = isNumRegex.test(nextKey) ? "array" : "object";

        if (Array.isArray(current)) {
            const key = Number(currentKey);

            if (!current[key]) {
                current[key] = nextType === "array" ? [] : {};
            }

            return current[key] as RawConfig | unknown[];
        }

        if (!current[currentKey]) {
            current[currentKey] = nextType === "array" ? [] : {};
        }

        return current[currentKey] as RawConfig | unknown[];
    }
}
