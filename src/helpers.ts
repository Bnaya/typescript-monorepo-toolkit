import { types } from "recast";
import * as childProcess from "child_process";
import * as path from "path";
import { promises as fsPromises, constants } from "fs";
import * as pMap from "p-map";
import partition = require("lodash.partition");
import * as debug from "debug";
import { assertNonNull } from "./assertNonNull";
import { parse, print } from "recast";
const debugFunc = debug("typescript-monorepo-toolkit");

export function wrapAsyncCommand(command: Promise<void>) {
  command.catch(error => {
    console.error("command exited with an error", error);
    process.exit(1);
  });
}

export function execFile(file: string, args: string[], cwd: string) {
  return new Promise<string>((res, rej) => {
    childProcess.execFile(
      file,
      args,
      {
        cwd
      },
      (error, stdOut) => {
        if (error) {
          rej(error);
        } else {
          res(stdOut);
        }
      }
    );
  });
}

export interface PackageInfo {
  location: string;
  mismatchedWorkspaceDependencies: string[];
  workspaceDependencies: string[];
}

export interface WorkspaceInfo {
  [packageName: string]: PackageInfo;
}

export async function partitionNoneTs(
  root: string,
  input: Array<[string, PackageInfo]>,
  tsconfigPath: string
): Promise<[Array<[string, PackageInfo]>, Array<[string, PackageInfo]>]> {
  return pMap(
    input,
    async ([packageName, packageInfo]) => {
      const is = await isTsPackage(
        root,
        packageName,
        packageInfo,
        tsconfigPath
      );
      return {
        is,
        packageName,
        packageInfo
      };
    },
    {
      concurrency: 4
    }
  ).then(all => {
    const [ts, noneTs] = partition(all, e => e.is);
    return [
      ts.map(e => [e.packageName, e.packageInfo]),
      noneTs.map(e => [e.packageName, e.packageInfo])
    ];

    // tuple map ain't smart enough
    // const o: [
    //   Array<[string, PackageInfo]>,
    //   Array<[string, PackageInfo]>
    // ] = afterPartition.map(part =>
    //   part.map(e => [e.packageName, e.packageInfo])
    // );

    // return o;
  });
}

// todo: support tsconfig.test, tsconfig.esm, etc
async function isTsPackage(
  root: string,
  packageName: string,
  packageInfo: PackageInfo,
  tsconfigPath: string
) {
  return await fsPromises
    .access(
      path.resolve(root, packageInfo.location, tsconfigPath),
      constants.F_OK
    )
    .then(
      () => true,
      () => false
    );
}

export async function applyOnPackage(
  root: string,
  packageName: string,
  packagesMap: Map<string, PackageInfo>,
  tsconfigPath: string
) {
  const packageInfo = packagesMap.get(packageName);
  assertNonNull(packageInfo);

  const absolutePath = path.resolve(root, packageInfo.location);

  const tsconfigContent = await fsPromises.readFile(
    path.resolve(root, packageInfo.location, tsconfigPath),
    "utf-8"
  );
  const asJs = `[${tsconfigContent}]`;

  const ast = parse(asJs, {});

  const deps = packageInfo.workspaceDependencies
    .map(depPackageName => packagesMap.get(depPackageName))
    .filter((v): v is NonNullable<typeof v> => v !== undefined);

  const paths = deps.map(d =>
    path.relative(absolutePath, path.resolve(root, d.location))
  );

  ensureCompositeProject(ast);
  setProjectReferences(ast, paths);

  await fsPromises.writeFile(
    path.resolve(root, packageInfo.location, tsconfigPath),
    print(ast)
      .code.substring(1)
      .slice(0, -1)
  );
}

export async function applyTransformationOnTSConfig(
  root: string,
  packageName: string,
  packagesMap: Map<string, PackageInfo>,
  tsconfigPath: string,
  transformation: (
    ast: any,
    root: string,
    packageName: string,
    packageInfo: PackageInfo
  ) => Promise<void>
) {
  const packageInfo = packagesMap.get(packageName);
  assertNonNull(packageInfo);

  const tsconfigContent = await fsPromises.readFile(
    path.resolve(root, packageInfo.location, tsconfigPath),
    "utf-8"
  );
  const asJs = `[${tsconfigContent}]`;

  const ast = parse(asJs, {});

  await transformation(ast, root, packageName, packageInfo);

  await fsPromises.writeFile(
    path.resolve(root, packageInfo.location, tsconfigPath),
    print(ast)
      .code.substring(1)
      .slice(0, -1)
  );
}

export function setProjectReferences(ast: any, pathsToAdd: string[]) {
  const refsNode = findEnsureProjectReferences(ast);
  refsNode.value.elements = [];

  for (const path of pathsToAdd) {
    refsNode.value.elements.push(
      types.builders.objectExpression([
        types.builders.property(
          "init",
          types.builders.literal("path"),
          types.builders.literal(path)
        )
      ])
    );
  }
}

export function findEnsureCompilerOptions(ast: any) {
  let compilerOptions = ast.program.body[0].expression.elements[0].properties.find(
    (p: { key: { value: string } }) => p.key.value === "compilerOptions"
  );

  if (!compilerOptions) {
    // create empty compiler options
    compilerOptions = types.builders.objectProperty(
      types.builders.literal("compilerOptions"),
      types.builders.objectExpression([])
    );

    ast.program.body[0].expression.elements[0].properties.unshift(
      compilerOptions
    );
  }

  return compilerOptions;
}

export function findEnsureProjectReferences(ast: any) {
  let references = ast.program.body[0].expression.elements[0].properties.find(
    (p: { key: { value: string } }) => p.key.value === "references"
  );

  if (!references) {
    // create empty compiler options
    references = types.builders.objectProperty(
      types.builders.literal("references"),
      types.builders.arrayExpression([])
    );

    ast.program.body[0].expression.elements[0].properties.push(references);
  }

  return references;
}

export function ensureCompositeProject(ast: any) {
  const compilerOptions = findEnsureCompilerOptions(ast);

  let compositeProp = compilerOptions.value.properties.find(
    (p: { key: { value: string } }) => p.key.value === "composite"
  );

  if (!compositeProp) {
    compositeProp = types.builders.objectProperty(
      types.builders.literal("composite"),
      types.builders.booleanLiteral(true)
    );

    compilerOptions.value.properties.push(compositeProp);
  }

  compositeProp.value = types.builders.booleanLiteral(true);
}

export function setCompilerOptionsStringProp(
  ast: any,
  propName: string,
  propValue: string | undefined
) {
  const compilerOptions = findEnsureCompilerOptions(ast);

  let propAst = compilerOptions.value.properties.find(
    (p: { key: { value: string } }) => p.key.value === propName
  );

  if (!propAst && propValue) {
    propAst = types.builders.objectProperty(
      types.builders.literal(propName),
      types.builders.stringLiteral(propValue)
    );

    compilerOptions.value.properties.push(propAst);
  }

  if (!propValue) {
    if (propAst) {
      // delete prop
      const index = compilerOptions.value.properties.indexOf(propAst);
      compilerOptions.value.properties.splice(index, 1);
    }
  } else {
    propAst.value = types.builders.stringLiteral(propValue);
  }
}

export async function applyTransformationOnAllPackages(
  projectRoot: string,
  tsconfigPathInsidePackages: string,
  transformation: (
    ast: any,
    root: string,
    packageName: string,
    packageInfo: PackageInfo
  ) => Promise<void>
) {
  const workspaceInfoObject = await readWorkspaceInfoObject(projectRoot);
  const workspaceInfoEntries = Object.entries(workspaceInfoObject);

  const [tsPackages, noneTsPackages] = await partitionNoneTs(
    projectRoot,
    workspaceInfoEntries,
    tsconfigPathInsidePackages
  );

  debugFunc(
    "found %d none-ts packages(?), ignoring them",
    noneTsPackages.length
  );
  debugFunc(
    "none ts: %j",
    noneTsPackages.map(p => p[0])
  );

  const map = new Map(tsPackages);

  await pMap(
    tsPackages,
    p => {
      applyTransformationOnTSConfig(
        projectRoot,
        p[0],
        map,
        tsconfigPathInsidePackages,
        transformation
      );
    },
    {
      concurrency: 4
    }
  );
}

export async function readWorkspaceInfoObject(
  projectRoot: string
): Promise<WorkspaceInfo> {
  const r = await execFile(
    "yarn",
    ["-s", "workspaces", "info", "--json"],
    projectRoot
  );

  try {
    return JSON.parse(JSON.parse(r).data);
  } catch (e) {
    return JSON.parse(r);
  }
}
