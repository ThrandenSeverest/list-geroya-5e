import test from "node:test";
import assert from "node:assert/strict";
import { armorClassBreakdown } from "../app/armor";
import type { ExportCharacter } from "../app/exportFormats";

const hero = (inventoryOverride: string, feats: string[] = [], spells: string[] = []): ExportCharacter => ({
  className: "fighter", level: 4, race: "human", raceVariant: "standard", inventoryOverride,
  abilities: { str: 12, dex: 16, con: 12, int: 10, wis: 10, cha: 10 }, feats, spells,
} as unknown as ExportCharacter);

test("Medium Armor Master raises only the medium armor Dexterity cap", () => {
  assert.equal(armorClassBreakdown(hero("Полулаты")).value, 17);
  assert.equal(armorClassBreakdown(hero("Полулаты", ["medium-armor-master"])).value, 18);
  assert.match(armorClassBreakdown(hero("Полулаты", ["medium-armor-master"])).base, /макс\. \+3/);
  assert.equal(armorClassBreakdown(hero("Кожаный доспех", ["medium-armor-master"])).value, 14);
  assert.equal(armorClassBreakdown(hero("Латы", ["medium-armor-master"])).value, 18);
});

test("conditional AC effects stay outside the permanent value", () => {
  const result = armorClassBreakdown(hero("", ["dual-wielder", "defensive-duelist"], ["mage-armor", "shield", "shield-of-faith", "haste"]));
  assert.equal(result.value, 13);
  assert(result.conditions.some(note => note.includes("Доспехи мага") && note.includes("16")));
  assert(result.conditions.some(note => note.includes("+5 КД")));
  assert(result.conditions.some(note => note.includes("+2 КД")));
  assert(result.conditions.some(note => note.includes("двух оружий")));
  assert(result.conditions.some(note => note.includes("Оборонительный дуэлянт")));
  assert.equal(armorClassBreakdown(hero("Полулаты", [], ["mage-armor"])).conditions.some(note => note.includes("Доспехи мага")), false);
});

test("monk and barbarian use their own unarmored defense only when eligible", () => {
  const monk = {...hero(""),className:"monk",abilities:{str:10,dex:16,con:14,int:10,wis:18,cha:10}} as unknown as ExportCharacter;
  assert.equal(armorClassBreakdown(monk).value,17);
  assert.equal(armorClassBreakdown(monk).selectedSource,"monk");
  const armored={...monk,adventure:{inventory:[{name:"Кожаный доспех",catalogName:"Кожаный доспех",equipped:true,quantity:1}],acSource:"monk"}} as unknown as ExportCharacter;
  assert.equal(armorClassBreakdown(armored).selectedSource,"armor");
  assert.equal(armorClassBreakdown(armored).value,14);
  assert.equal(armorClassBreakdown({...monk,inventoryOverride:"Щит"}).sources.some(s=>s.id==="monk"),false);
  const barbarian={...hero(""),className:"barbarian",abilities:{str:16,dex:14,con:18,int:10,wis:10,cha:10}} as unknown as ExportCharacter;
  assert.equal(armorClassBreakdown(barbarian).value,16);
  assert.equal(armorClassBreakdown(barbarian).selectedSource,"barbarian");
  assert.equal(armorClassBreakdown({...barbarian,inventoryOverride:"Щит"}).value,18);
});

test("manual AC source can choose a lower eligible formula and persists independently of numeric override",()=>{
  const monk={...hero(""),className:"monk",abilities:{str:10,dex:16,con:14,int:10,wis:18,cha:10},adventure:{inventory:[],acSource:"unarmored"}} as unknown as ExportCharacter;
  assert.equal(armorClassBreakdown(monk).value,13);
  assert.equal(armorClassBreakdown(monk).selectedSource,"unarmored");
  assert.equal(armorClassBreakdown({...monk,adventure:{...monk.adventure!,acSource:"monk"}}).value,17);
});
