import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const builder = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("characteristic step uses the declared racial choice groups identifier", () => {
  assert.match(builder, /const racialChoiceGroups\s*=\s*racialSpellChoiceOptions\(/);
  assert.match(builder, /\{racialChoiceGroups\.length\s*>\s*0\s*&&\s*racialChoiceGroups\.map\(/);
  assert.doesNotMatch(builder, /\bracialSpellChoiceGroups\b/);
});
