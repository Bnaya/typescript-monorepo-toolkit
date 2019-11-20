// How to preserve comments? use jscodeshift?
// https://github.com/json5/json5/issues/177

import * as commander from "commander";
import * as debug from "debug";
import {
  wrapAsyncCommand,
  applyTransformationOnAllPackages,
  setCompilerOptionsStringProp
} from "./helpers";
import colors = require("colors");
import { injectRefs } from "./commands";

const debugFunc = debug("typescript-monorepo-toolkit");

const program = new commander.Command();
program.version("0.0.1");

program.option(
  "-p, --tsconfig-path <tsconfigpath>",
  "Use alterative config path inside the package. eg: test/tsconfig.json",
  "tsconfig.json"
);

program
  .command("inject-refs <yarn-project-root>")
  .description(
    "Inject the appropriate tsconfig references based on yarn workspaces dependency graph"
  )
  .option(
    "-a, --generate-build-all",
    "Generate top level build-all-tsconfig.json with references to the leaf packages",
    false
  )
  .action((yarnWorkspaceRoot, cmdObj) => {
    debugFunc("Running command inject-refs with %O", {
      yarnWorkspaceRoot,
      cmdObj
    });
    wrapAsyncCommand(
      injectRefs(yarnWorkspaceRoot, {
        generateBuildAll: cmdObj.generateBuildAll,
        tsconfigPathInsidePackages: program.tsconfigPath
      })
    );
  });

program
  .command("set-outDir <yarn-project-root> [newOutDir]")
  .description(
    "Set the compilerOptions.outDir in all of the packages. omit new value to delete"
  )
  .action((yarnWorkspaceRoot, newOutDir) => {
    wrapAsyncCommand(
      applyTransformationOnAllPackages(
        yarnWorkspaceRoot,
        program.tsconfigPath,
        async ast => {
          setCompilerOptionsStringProp(ast, "outDir", newOutDir);
        }
      )
    );
  });

program
  .command("set-rootDir <yarn-project-root> [newRootDir]")
  .description(
    "Set the compilerOptions.rootDir in all of the packages. omit new value to delete"
  )
  .action((yarnWorkspaceRoot, newOutDir) => {
    wrapAsyncCommand(
      applyTransformationOnAllPackages(
        yarnWorkspaceRoot,
        program.tsconfigPath,
        async ast => {
          setCompilerOptionsStringProp(ast, "rootDir", newOutDir);
        }
      )
    );
  });

if (!process.argv.slice(2).length) {
  program.outputHelp(makeRed);
}

function makeRed(txt: string) {
  return colors.red(txt); //display the help text in red on the console
}

program.parse(process.argv);
