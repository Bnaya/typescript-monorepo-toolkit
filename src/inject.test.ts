/* eslint-env jest */

import { parse, print } from "recast";
import { promises as fsPromises } from "fs";
import * as path from "path";
import {
  ensureCompositeProject,
  setProjectReferences,
  setRootStringProp,
} from "./helpers";
import jestDiff from "jest-diff";
import * as json5 from "json5";
import assert from "assert";

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

describe("setRootStringProp", () => {
  it("adds missing", () => {
    const asString = JSON.stringify({
      compilerOptions: {},
      include: [],
    });
    const itsJSwinkwink = `[${asString}]`;

    const ast = parse(itsJSwinkwink);

    setRootStringProp(ast, "extends", "ciao");

    const objectAfter = JSON.parse(print(ast).code)[0];
    assert(objectAfter.extends === "ciao");
  });

  it("replace", () => {
    const asString = JSON.stringify({
      compilerOptions: {},
      include: [],
      extends: "hello",
    });
    const itsJSwinkwink = `[${asString}]`;

    const ast = parse(itsJSwinkwink);

    setRootStringProp(ast, "extends", "another_one");

    const objectAfter = JSON.parse(print(ast).code)[0];
    assert(objectAfter.extends === "another_one");
  });
});
