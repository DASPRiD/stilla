import assert from "node:assert";
import {
    ZodArray,
    ZodBoolean,
    ZodDefault,
    ZodEffects,
    ZodEnum,
    ZodNativeEnum,
    ZodNullable,
    ZodNumber,
    ZodObject,
    ZodOptional,
    type ZodRawShape,
    ZodString,
    type ZodTypeAny,
    ZodUnion,
    type ZodUnionOptions,
} from "zod";

export type TypeHint = "string" | "number" | "boolean";
export type Path = [string, TypeHint];

export class PathMap implements Iterable<Readonly<Path>> {
    private readonly paths = new Map<string, TypeHint>();

    public constructor(schema: ZodTypeAny) {
        this.addPaths(schema);
    }

    [Symbol.iterator](): Iterator<Readonly<Path>> {
        return this.paths[Symbol.iterator]();
    }

    public get(path: string): TypeHint | null {
        return this.paths.get(path) ?? null;
    }

    private addPaths(schema: ZodTypeAny, parentPath = ""): void {
        if (schema instanceof ZodObject) {
            for (const [key, subSchema] of Object.entries(schema.shape as ZodRawShape)) {
                this.addPaths(subSchema, parentPath ? `${parentPath}.${key}` : key);
            }
        } else if (schema instanceof ZodArray) {
            this.addPaths(schema.element, `${parentPath}.#`);
        } else if (schema instanceof ZodEffects) {
            this.addPaths(schema._def.schema, parentPath);
        } else if (
            schema instanceof ZodDefault ||
            schema instanceof ZodOptional ||
            schema instanceof ZodNullable
        ) {
            this.addPaths(schema._def.innerType, parentPath);
        } else if (schema instanceof ZodUnion) {
            this.handleUnion(schema, parentPath);
        } else {
            this.add(parentPath, extractType(schema));
        }
    }

    private handleUnion(schema: ZodUnion<ZodUnionOptions>, parentPath: string): void {
        const types = schema._def.options;
        const primitiveTypes = new Set<TypeHint>();
        let hasObject = false;

        for (const type of types) {
            if (type instanceof ZodObject) {
                hasObject = true;
                this.addPaths(type, parentPath);
                continue;
            }

            primitiveTypes.add(extractType(type));
        }

        if (hasObject) {
            if (primitiveTypes.size > 0) {
                throw new Error(`Union at path '${parentPath}' mixes objects and primitives`);
            }

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

const extractType = (schema: ZodTypeAny): TypeHint => {
    if (schema instanceof ZodString) {
        return "string";
    }

    if (schema instanceof ZodNumber) {
        return "number";
    }

    if (schema instanceof ZodBoolean) {
        return "boolean";
    }

    if (schema instanceof ZodEnum) {
        return "string";
    }

    if (schema instanceof ZodNativeEnum) {
        return "string";
    }

    if (
        schema instanceof ZodDefault ||
        schema instanceof ZodOptional ||
        schema instanceof ZodNullable
    ) {
        return extractType(schema._def.innerType);
    }

    /* node:coverage ignore next */
    assert.fail(`Unsupported Zod type: ${schema.constructor.name}`);
};
