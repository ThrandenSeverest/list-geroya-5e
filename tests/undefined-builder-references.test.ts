import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

// Vinext transpiles TSX without rejecting unknown variables. The 2026-10-07
// production incident was an undeclared identifier in Builder render code.
// Check semantic diagnostics before publishing, independent of the JS bundler.
test("character builder has no undeclared TypeScript identifiers", () => {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
  assert.ok(configPath, "tsconfig.json must exist");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined, "tsconfig.json must parse");
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, incremental: false },
  });
  const builder = program.getSourceFile(path.resolve("app/page.tsx"));
  assert.ok(builder, "app/page.tsx must be in TypeScript project");
  const diagnostics = program.getSemanticDiagnostics(builder)
    .filter(diagnostic => diagnostic.code === 2304 || diagnostic.code === 2552)
    .map(diagnostic => {
      const position = diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : null;
      return `${diagnostic.file?.fileName || "unknown"}:${(position?.line ?? 0) + 1}:${(position?.character ?? 0) + 1}: TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    });
  assert.deepEqual(diagnostics, [], "The builder must never refer to undeclared names.");
});
