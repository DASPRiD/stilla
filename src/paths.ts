import assert from "node:assert";
import { type $ZodType, type $ZodTypes, toJSONSchema, type util } from "zod/v4/core";

export type TypeHint = "string" | "number" | "boolean" | "bigint";
export type Path = [string, TypeHint];

export class PathMap implements Iterable<Readonly<Path>> {
    private readonly paths = new Map<string, TypeHint>();

    public constructor(schema: $ZodType) {
        this.addPaths(schema as $ZodTypes);
    }

    [Symbol.iterator](): Iterator<Readonly<Path>> {
        return this.paths[Symbol.iterator]();
    }

    public get size(): number {
        return this.paths.size;
    }

    public get(path: string): TypeHint | null {
        return this.paths.get(path) ?? null;
    }

    private addPaths(schema: $ZodType, parentPath = ""): void {
        const def = (schema as $ZodTypes)._zod.def;

        switch (def.type) {
            case "array": {
                this.addPaths(def.element, `${parentPath}.#`);
                break;
            }

            case "object": {
                for (const key in def.shape) {
                    this.addPaths(def.shape[key], parentPath ? `${parentPath}.${key}` : key);
                }

                break;
            }

            case "union": {
                this.handleUnion(def.options, parentPath);
                break;
            }

            case "pipe": {
                this.addPaths(def.in, parentPath);
                break;
            }

            case "nullable":
            case "optional":
            case "nonoptional":
            case "readonly":
            case "default":
            case "prefault": {
                this.addPaths(def.innerType, parentPath);
                break;
            }

            default: {
                const typeHint = extractType(schema);

                if (typeHint) {
                    this.add(parentPath, typeHint);
                }
            }
        }
    }

    private handleUnion(options: readonly $ZodType[], parentPath: string): void {
        const primitiveTypes = new Set<TypeHint>();
        let hasObject = false;

        for (const option of options) {
            const def = (option as $ZodTypes)._zod.def;

            if (def.type === "object") {
                hasObject = true;
                this.addPaths(option, parentPath);
                continue;
            }

            const typeHint = extractType(option);

            if (typeHint) {
                primitiveTypes.add(typeHint);
            }
        }

        if (hasObject) {
            if (primitiveTypes.size > 0) {
                throw new Error(`Union at path '${parentPath}' mixes objects and primitives`);
            }

            return;
        }

        if (primitiveTypes.size === 0) {
            return;
        }

        if (primitiveTypes.size > 1) {
            throw new Error(`Union at path '${parentPath}' mixes primitives of different types`);
        }

        const typeHint = primitiveTypes.values().next().value;
        assert(typeHint);

        this.add(parentPath, typeHint);
    }

    private add(path: string, type: TypeHint): void {
        if (this.paths.has(path)) {
            const existingType = this.paths.get(path);

            if (existingType !== type) {
                throw new Error(
                    `Collision detected at path '${path}': type '${existingType}' vs '${type}'`,
                );
            }
        }

        this.paths.set(path, type);
    }
}

const extractType = (schema: $ZodType): TypeHint | null => {
    const def = (schema as $ZodTypes)._zod.def;

    switch (def.type) {
        case "string":
        case "number":
        case "boolean":
        case "bigint":
            return def.type;

        case "template_literal":
            return "string";

        case "literal":
            return extractLiteralValue(def.values);

        case "enum":
            return "string";

        case "null":
        case "undefined":
        case "never":
            return null;

        case "nullable":
        case "optional":
        case "nonoptional":
        case "readonly":
        case "default":
        case "prefault":
            return extractType(def.innerType);

        default: {
            const jsonSchema = toJSONSchema(schema, { io: "input" });

            switch (jsonSchema.type) {
                case "string":
                case "number":
                case "boolean":
                    return jsonSchema.type;
            }
        }
    }

    /* node:coverage ignore next */
    assert.fail(`Unsupported Zod type: ${def.type}`);
};

const extractLiteralValue = (values: util.LiteralArray): TypeHint | null => {
    const prunedValues = values.filter((value) => value !== null && value !== undefined);

    if (prunedValues.length === 0) {
        return null;
    }

    const types = new Set<TypeHint>();

    for (const value of prunedValues) {
        if (typeof value === "string") {
            types.add("string");
        } else if (typeof value === "number") {
            types.add("number");
        } else if (typeof value === "boolean") {
            types.add("boolean");
        } else if (typeof value === "bigint") {
            types.add("bigint");
            /* node:coverage ignore next 3 */
        } else {
            throw new Error(`Unsupported literal value: ${value}`);
        }
    }

    if (types.size > 1) {
        throw new Error("Literals with mixed types are not supported");
    }

    const type = types.values().next().value;
    assert(type);
    return type;
};
