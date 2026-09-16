import assert from "node:assert/strict";
import { documentedClassFeatures } from "../app/featureDetails";
import { sheetChoiceDescriptions, sheetClassFeatures, sheetOptionalFeatures, sheetSubclassFeatures } from "../app/generatedSheetRules";

const expectedSubclassCounts: Record<string, number> = {
  barbarian: 9, bard: 8, cleric: 14, druid: 7, fighter: 10, monk: 10, paladin: 9,
  ranger: 8, rogue: 9, sorcerer: 8, warlock: 9, wizard: 13, artificer: 4,
};
assert.deepEqual(Object.keys(sheetClassFeatures).sort(), Object.keys(expectedSubclassCounts).sort());
assert.equal(Object.values(sheetSubclassFeatures).reduce((total, entries) => total + Object.keys(entries).length, 0), 118);
for (const [classId, count] of Object.entries(expectedSubclassCounts)) {
  assert.equal(Object.keys(sheetSubclassFeatures[classId] || {}).length, count, classId);
  assert((sheetClassFeatures[classId] || []).length > 0, classId);
}

const allFeatures = [
  ...Object.values(sheetClassFeatures).flat(),
  ...Object.values(sheetOptionalFeatures).flat(),
  ...Object.values(sheetSubclassFeatures).flatMap(entries => Object.values(entries).flat()),
];
assert.equal(allFeatures.length, 720);
for (const feature of allFeatures) {
  assert(feature.name.trim(), "empty feature name");
  assert(feature.description.trim(), feature.name);
  assert((feature.level || 0) >= 0 && (feature.level || 0) <= 20, feature.name);
}
assert(Object.keys(sheetChoiceDescriptions).length >= 90);
assert(Object.values(sheetChoiceDescriptions).every(description => description.trim().length > 0));

for (const classId of Object.keys(expectedSubclassCounts)) {
  const finalSheet = documentedClassFeatures(classId, undefined, true, [], [], []);
  const names = finalSheet.map(feature => feature.name.toLocaleLowerCase("ru-RU").replace(/ё/g, "е"));
  assert(!names.includes("использование заклинаний"), classId);
  assert(!names.includes("увеличение характеристик"), classId);
  assert(!names.includes("увеличение значения характеристик"), classId);
}

console.log("Sheet-text coverage passed: 13 classes, 118 subclasses, 720 non-empty gameplay features and 90+ concrete choice texts.");
