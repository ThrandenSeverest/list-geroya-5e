import test from "node:test";
import assert from "node:assert/strict";
import type { ExportCharacter } from "../app/exportFormats";
import { characterResources, resourceCurrent, resourceRestLabel, spentResourcesAfterLongRest } from "../app/characterResources";

const phantom = { className: "rogue", subclass: "phantom", level: 9, race: "human", raceVariant: "standard",
  abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
  resourceSpent: { "tokens-of-departed": 2, "wails-from-grave": 3 },
} as unknown as ExportCharacter;

test("Phantom tokens retain their spent state across long rest and explain their recovery", () => {
  const resources = characterResources(phantom);
  const tokens = resources.find(resource => resource.key === "tokens-of-departed")!;
  const wails = resources.find(resource => resource.key === "wails-from-grave")!;
  assert.equal(tokens.isLongRest, false);
  assert.equal(resourceRestLabel(tokens), "не восстанавливается отдыхом");
  const rested = { ...phantom, resourceSpent: spentResourcesAfterLongRest(phantom) };
  assert.deepEqual(rested.resourceSpent, { "tokens-of-departed": 2 });
  assert.equal(resourceCurrent(rested, tokens), tokens.max - 2);
  assert.equal(resourceCurrent(rested, wails), wails.max);
});
