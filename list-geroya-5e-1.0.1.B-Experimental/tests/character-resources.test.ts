import assert from "node:assert/strict";
import { characterResources, resourceRestLabel } from "../app/characterResources";
import type { ExportCharacter } from "../app/exportFormats";

const character: ExportCharacter = {
  name: "Удачливый герой", playerName: "", race: "human", raceVariant: "variant", className: "fighter", background: "soldier",
  classSkills: [], backgroundSkills: [], level: 4, spells: [], preparedSpells: [], alignment: "",
  feats: [], advancements: [{ key: "asi-4", level: 4, featId: "lucky", asiChoices: [] }],
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
};

const lucky = characterResources(character).find(resource => resource.key === "lucky");
assert(lucky, "Lucky must appear in printable resources");
assert.equal(lucky.max, 3, "Lucky must render three luck circles");

const barbarianResources = characterResources({ ...character, className: "barbarian", subclass: "berserker", level: 6 });
const rage = barbarianResources.find(resource => resource.key === "rage");
assert.equal(rage?.max, 4, "Rage must be tracked with its level-based uses");
assert.equal(resourceRestLabel(rage!), "длин.");

const bladeSingerResources = characterResources({ ...character, className: "wizard", subclass: "bladesinging", level: 6 });
const bladesong = bladeSingerResources.find(resource => resource.key === "bladesong");
assert.equal(bladesong?.max, 2, "SCAG Bladesong must have two uses");
assert.equal(resourceRestLabel(bladesong!), "кор./длин.");

console.log("Feat, race, class, and subclass rest resources are included in the shared tracker.");
