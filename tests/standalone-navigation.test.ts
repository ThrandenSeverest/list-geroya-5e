import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("app/page.tsx", "utf8");
const desktop = readFileSync("standalone/windows/main.cjs", "utf8");

test("Adventure creation uses an in-app text dialog instead of unsupported Electron prompt()", () => {
  assert.match(page, /function sendToAdventure\(id: string\)/);
  assert.match(page, /setTextEntryDialog\(\{ kind: "adventure", id, value: "Новое приключение" \}\)/);
  assert.match(page, /function createNamedAdventure\(id: string, name: string\)/);
  assert.match(page, /window\.location\.assign\(assetUrl\(`adventure\/\?play=/);
  assert.doesNotMatch(page, /\b(?:window\.)?prompt\s*\(/);
});

test("Both saved-character and builder screens mount the same adventure dialog", () => {
  const nodes = page.match(/\{textEntryModal\}/g) || [];
  assert.equal(nodes.length, 2);
  assert.match(page, /<form onSubmit=\{event => \{ event\.preventDefault\(\); onConfirm\(\); \}\}>/);
});

test("Desktop exposes the persistent save-profile directory to the user", () => {
  assert.match(desktop, /shell\.openPath\(app\.getPath\('userData'\)\)/);
  assert.match(desktop, /Открыть папку сохранений/);
});
