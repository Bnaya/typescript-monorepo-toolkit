/* eslint-env jest */

import { parse, print } from "recast";
import { promises as fsPromises } from "fs";
import * as path from "path";
import { ensureCompositeProject, setProjectReferences } from "./helpers";
import * as jestDiff from "jest-diff";
import * as json5 from "json5";

describe("modify tsconfig", () => {
  test("ensure composite", async () => {
    const asString = await fsPromises.readFile(
      path.resolve(__dirname, "../fixtures/tsconfig.json"),
      "utf-8"
    );
    const itsJSwinkwink = `[${asString}]`;

    const ast = parse(itsJSwinkwink);

    ensureCompositeProject(ast);

    const stringAfter = print(ast).code;

    expect(
      jestDiff(
        json5.parse(asString).compilerOptions,
        json5.parse(stringAfter.substring(1).slice(0, -1)).compilerOptions,
        {
          // contextLines: 1
        }
      )
    ).toMatchInlineSnapshot(`
      "- Expected
      + Received

        Object {
      +   \\"composite\\": true,
          \\"esModuleInterop\\": false,
          \\"forceConsistentCasingInFileNames\\": true,
          \\"isolatedModules\\": true,
          \\"lib\\": Array [
            \\"es2018\\",
          ],
          \\"module\\": \\"commonjs\\",
          \\"strict\\": true,
          \\"target\\": \\"es2019\\",
          \\"types\\": Array [
            \\"node\\",
            \\"jest\\",
          ],
        }"
    `);
  });

  test("setProjectReferences", async () => {
    const asString = await fsPromises.readFile(
      path.resolve(__dirname, "../fixtures/tsconfig.json"),
      "utf-8"
    );
    const itsJSwinkwink = `[${asString}]`;

    const ast = parse(itsJSwinkwink);

    setProjectReferences(ast, ["../core", "../common", "mobile"]);

    const stringAfter = print(ast).code;

    expect(stringAfter).toMatchSnapshot();

    // const a = json5.parse(asString, (key, value) =>
    //   key === "compilerOptions" ? undefined : value
    // );

    // const b = json5.parse(stringAfter.substring(1).slice(0, -1), (key, value) =>
    //   key === "compilerOptions" ? undefined : value
    // );

    // expect(
    //   jestDiff(a, b, {
    //     // contextLines: 1
    //   })
    // ).toMatchInlineSnapshot(`
    //   "[32m- Expected[39m
    //   [31m+ Received[39m

    //   [2m  Object {[22m
    //   [2m    \\"include\\": Array [[22m
    //   [2m      \\"src\\",[22m
    //   [2m    ],[22m
    //   [31m+   \\"references\\": Object {},[39m
    //   [2m  }[22m"
    // `);
  });
});
