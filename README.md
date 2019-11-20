# typescript-monorepo-toolkit

## CLI tool to automatically setup typescript project references for yarn workspaces monorepos and other tasks

It can inject the appropriate tsconfig.references for all of the packages in a yarn workspace, and also help you change `rootDir` and `outDir` across all of the packages

Background / Motivation:

* <https://github.com/thi-ng/> 100+ packages monorepo that i want to move to project refs
* [Infer project references from common monorepo patterns / tools #25376](https://github.com/microsoft/TypeScript/issues/25376)

How to use

```sh
npx typescript-monorepo-toolkit inject-refs ../path-to/yarn-project-root
```

For debug info

```sh
DEBUG=typescript-monorepo-toolkit npx typescript-monorepo-toolkit inject-refs ../path-to/yarn-project-root
```

```sh
Usage:  [options] [command]

Options:
  -V, --version                                 output the version number
  -p, --tsconfig-path <tsconfigpath>            Use alterative config path inside the package. eg: test/tsconfig.json (default: "tsconfig.json")
  -h, --help                                    output usage information

Commands:
  inject-refs [options] <yarn-project-root>     Inject the appropriate tsconfig references based on yarn workspaces dependency graph
  set-outDir <yarn-project-root> [newOutDir]    Set the compilerOptions.outDir in all of the packages. omit new value to delete
  set-rootDir <yarn-project-root> [newRootDir]  Set the compilerOptions.rootDir in all of the packages. omit new value to delete
  ```

## How does it work

`yarn workspaces info` command has all the info we need.

The `tsconfig.json` manipulation is done using [recast](https://github.com/benjamn/recast), as `tsconfig.json` is not really JSON, so we can keep the comments. Unfortunately recast changes some of the formatting of the file.

This tool might break your tsconfigs
**Please run this tool on a clean git state, and inspect the diff**

## Future possible improvements

* Become obsolete when [#25376](https://github.com/microsoft/TypeScript/issues/25376) is fixed
* Find a good name
* Support `tsconfig.test.json` and similar patterns
* Support lerna/other monorepo tools that can provider us with the dependency graph
