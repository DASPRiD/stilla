import type { RawConfig } from "./provider/index.js";

export const isRawConfig = (value: unknown): value is RawConfig =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep merges target into source.
 *
 * - Objects are merged recursively.
 * - Arrays in `target` **override** arrays in `source`.
 * - Primitives are replaced directly.
 */
export const deepMerge = (source: RawConfig, target: RawConfig): void => {
    for (const key in target) {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue)) {
            source[key] = targetValue;
        } else if (isRawConfig(targetValue) && isRawConfig(sourceValue)) {
            deepMerge(sourceValue, targetValue);
        } else {
            source[key] = targetValue;
        }
    }
};
