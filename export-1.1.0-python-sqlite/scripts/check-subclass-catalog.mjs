import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.resolve(here, relative), "utf8");
const rules = read("../app/characterRules.ts");

const expectedCounts = {
  barbarian: 9, bard: 8, cleric: 14, druid: 7, fighter: 10, monk: 10,
  paladin: 9, ranger: 8, rogue: 9, sorcerer: 8, warlock: 9, wizard: 13, artificer: 4,
};
const total = Object.values(expectedCounts).reduce((sum, value) => sum + value, 0);
if (total !== 118) throw new Error(`Invalid acceptance fixture: ${total}`);

const missing = {
  barbarian: ["battlerager", "stormherald", "wildmagic", "beast", "giant"],
  bard: ["creation", "spirits"],
  cleric: ["tempest", "knowledge", "trickery", "nature", "death", "arcana", "peace", "order"],
  druid: ["spores"], fighter: ["banneret", "echo-knight", "psi-warrior"],
  monk: ["four-elements", "long-death", "astral-self", "ascendant-dragon"],
  paladin: ["oathbreaker", "crown", "glory"], ranger: ["swarmkeeper", "drakewarden"],
  rogue: ["phantom"], sorcerer: ["clockwork"], warlock: ["undying", "fathomless", "undead"],
  wizard: ["chronurgy", "graviturgy"],
};

const problems = [];
const need = (file, marker) => {
  const value = read(file);
  if (!value.includes(marker)) problems.push(`${file}: ${marker}`);
};
for (const [classId, ids] of Object.entries(missing)) {
  for (const id of ids) {
    const metadata = `classId: "${classId}", id: "${id}"`;
    const base = `SC("${id}"`;
    if (!rules.includes(metadata) && !rules.includes(base)) problems.push(`characterRules.ts: ${classId}/${id}`);
  }
}

for (const source of ["PHB","DMG","SCAG","XGE","GGR","MOT","EGW","TCE","VRGR","FTD","BPGG"]) need("../app/catalogFilters.ts", source);
need("../app/characterRules.ts", "SUBCLASS_SPELL_GRANTS_5E14");
need("../app/characterRules.ts", "subclassSpellGrantTable");
need("../app/characterRules.ts", "mode: \"always-prepared\"");
need("../app/characterRules.ts", "mode: \"known\"");
need("../app/characterRules.ts", "mode: \"expanded\"");
need("../app/characterRules.ts", "dmApproval");
need("../app/multiclass.ts", "selectedSubclassForClass");
need("../app/multiclass.ts", "migratedChoiceValues");
need("../app/classChoices.ts", "four-elements-disciplines");
need("../app/classChoices.ts", "storm-herald-environment");
need("../app/proficiencies.ts", "subclass-cleric-knowledge-skills");
need("../app/characterResources.ts", "psi-warrior-dice");
need("../app/combat.ts", "subclass-drakewarden-bite");
need("../app/languages.ts", "subclass === \"drakewarden\"");

if (problems.length) {
  console.error("Subclass integration acceptance check failed:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`Subclass integration acceptance OK: target ${total}; 35 formerly missing IDs and core integration surfaces are present.`);
