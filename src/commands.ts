import {
  partitionNoneTs,
  applyOnPackage,
  readWorkspaceInfoObject,
} from "./helpers";
import pMap = require("p-map");
import debug = require("debug");
import path from "path";
import { promises as fsPromises } from "fs";

const debugFunc = debug("typescript-monorepo-toolkit");

export async function injectRefs(
  projectRoot: string,
  options: { tsconfigPathInsidePackages: string; generateBuildAll: boolean }
) {
  const workspaceInfoObject = await readWorkspaceInfoObject(projectRoot);
  const workspaceInfoEntries = Object.entries(workspaceInfoObject);

  const [tsPackages, noneTsPackages] = await partitionNoneTs(
    projectRoot,
    workspaceInfoEntries,
    options.tsconfigPathInsidePackages
  );

  debugFunc(
    "found %d none-ts packages(?), ignoring them",
    noneTsPackages.length
  );
  debugFunc(
    "none ts: %j",
    noneTsPackages.map((p) => p[0])
  );

  const map = new Map(tsPackages);

  await pMap(
    tsPackages,
    (p) => {
      applyOnPackage(
        projectRoot,
        p[0],
        map,
        options.tsconfigPathInsidePackages
      );
    },
    {
      concurrency: 4,
    }
  );

  // packages no-one is depending on
  const topLevelPackages = tsPackages.filter(([packageName]) =>
    tsPackages.every(
      ([, isDependedOn]) =>
        !isDependedOn.workspaceDependencies.includes(packageName)
    )
  );

  console.log("Done!", tsPackages.length, " packages");
  console.log("Top Level Packages Count:", topLevelPackages.length);

  if (options.generateBuildAll) {
    const buildAllTSConfig = {
      references: topLevelPackages.map(([, info]) => ({
        path: path.relative(
          projectRoot,
          path.resolve(projectRoot, info.location)
        ),
      })),
      include: [],
    };

    await fsPromises.writeFile(
      path.resolve(projectRoot, "build-all-tsconfig.json"),
      JSON.stringify(buildAllTSConfig, null, 2)
    );

    console.log("build-all-tsconfig.json created/updated");
  }
}
