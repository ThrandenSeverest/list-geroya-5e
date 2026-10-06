import test from "node:test";
import assert from "node:assert/strict";
import { isStaticPages } from "../app/accountAvailability";

test("Pages uses local saves while server hosting keeps account authentication", () => {
  assert.equal(isStaticPages("thrandenseverest.github.io"), true);
  assert.equal(isStaticPages("herolist.superaistory.fun"), false);
  assert.equal(isStaticPages("localhost"), false);
  assert.equal(isStaticPages("github.io.example.com"), false);
});
