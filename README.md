# Stilla

[![Release](https://github.com/DASPRiD/stilla/actions/workflows/release.yml/badge.svg)](https://github.com/DASPRiD/stilla/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/DASPRiD/stilla/graph/badge.svg?token=fIfFH7e0On)](https://codecov.io/gh/DASPRiD/stilla)

Stilla is a flexible configuration management system that allows you to define and resolve configurations from various 
sources, such as environment variables and files in different formats (JSON, YAML, TOML, etc.). It uses a schema to
validate and parse the configurations, ensuring that the configuration values are of the expected types.

## Features

- **Multiple Configuration Providers**: Supports reading configurations from environment variables and files.
- **Schema Validation**: Uses `zod` for schema validation and parsing.
- **Type Hinting**: Uses type hints from the schema to parse environment variables.
- **Nested Configuration**: Supports nested configurations and arrays.
- **Customizable**: Easily extendable by adding new configuration providers.

## Installation

Install the package using your favorite package manager:

```bash
npm install stilla
pnpm add stilla
yarn add stilla
```

## Usage

### Define a Schema

First, define a schema using `zod`:

```typescript
import { z } from 'zod';

const schema = z.object({
    key1: z.string(),
    key2: z.number(),
    nested: z.object({
        key3: z.boolean(),
    }),
    array: z.array(z.object({
        key4: z.string(),
    })),
});
```

### Create a ConfigResolver

Create a `ConfigResolver` instance with the schema:

```typescript
import { ConfigResolver } from "stilla";

const resolver = ConfigResolver.default(schema);
```

This will create a default resolver. It will first parse all your config files located in the "config" folder in the
current working directory and then override anything found in environment variables.  

Alternatively, you can create a resolver with custom configuration:

```typescript
import { ConfigResolver } from "stilla";

const resolver = new ConfigResolver(schema);
resolver.addProvider(new FileConfigProvider({ basePath: "/path/to/config" }), 50);
```

### Resolve the Configuration

Resolve the configuration and use it in your application:

```typescript
const config = await resolver.resolve();
console.log(config);
```

## Configuration Providers

### Environment Variable Provider

The `EnvConfigProvider` reads configuration values from environment variables. You can specify a prefix to filter 
environment variables and provide custom variables for testing purposes.

```typescript
import { EnvConfigProvider } from "stilla";

const envProvider = new EnvConfigProvider({
    prefix: "APP_",
    variables: {
        APP_KEY1: "value1",
        APP_KEY2: "42",
        APP_NESTED_KEY3: "true",
        APP_ARRAY_0_KEY4: "value2",
        APP_ARRAY_1_KEY4: "value3",
    },
});
```

### File Provider

The `FileConfigProvider` reads configuration values from files. It supports multiple file formats, including JSON, YAML,
TOML, and JSON5.

```typescript
import { FileConfigProvider } from "stilla";

const fileProvider = new FileConfigProvider({
    basePath: "/path/to/config",
});
```

Files are loaded in the following order (latter files override earlier ones):

- `default.<ext>`
- `<env>.<ext>`
- `local.<ext>`
- `local-<env>.<ext>`

While in theory you can have the same file with different extensions present, the order in which they are loaded
is not guaranteed, and you should refrain from doing so.

By default, only the `json` extension is supported by default. In order to enable support for other extensions, you must
install a parser dependency for the ones you want to use:

- YAML: `yaml`
- TOML: `smol-toml`
- JSON5: `json5`

## Testing

Unit tests are provided to ensure the correctness of the configuration providers and the resolver. To run the tests, 
use the following command:

```bash
pnpm test
```

## Contributing

Contributions are welcome! Please open an issue or a pull request if you have any suggestions or improvements.

## License

This project is licensed under the BSD-2-Clause License.
