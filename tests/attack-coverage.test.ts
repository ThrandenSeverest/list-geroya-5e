import test from "node:test";
import assert from "node:assert/strict";
import { characterAttacks, lssWeaponAttacks } from "../app/combat";
import { spells } from "../app/catalog";
import type { ExportCharacter } from "../app/exportFormats";
const hero = (className = "wizard", level = 5, subclass = "") => ({
  className, level, subclass, race: "human", raceVariant: "standard", spells: [],
  abilities: { str: 12, dex: 16, con: 14, int: 18, wis: 16, cha: 14 }, inventoryOverride: "",
  classSkills: [], backgroundSkills: [], feats: [], advancements: [],
} as unknown as ExportCharacter);
test("added damaging cantrips scale at total-level thresholds and use the right save mode", () => {
  const expected = [
    ["chill-touch","d8",false],["spell-doc-poison_spray","d12",true],
    ["spell-doc-create_bonfire","d8",true],["spell-doc-frostbite","d6",true],
    ["spell-doc-infestation","d6",true],["spell-doc-primal_savagery","d10",false],
    ["spell-doc-thunderclap","d6",true],["spell-doc-lightning_lure","d8",true],
    ["spell-doc-sword_burst","d6",true],["spell-doc-sapping_sting","d4",true],
  ] as const;
  for (const [level,count] of [[1,1],[5,2],[11,3],[17,4]]) {
    for (const [id,die,save] of expected) {
      assert(spells.some(spell=>spell.id===id),id);
      const attack=characterAttacks({...hero("wizard",level),spells:[id]},spells).find(a=>a.id==="cantrip-"+id)!;
      assert(attack,id); assert.equal(attack.damageFormula,count+die,id);
      assert.equal(attack.attackBonus===undefined,save,id);
      assert.equal(attack.saveDc!==undefined,save,id);
      if(save) assert.match(attack.note!,/Спасбросок:/);
    }
  }
});
test("magic stone is fixed damage and source grants are included once", () => {
  const c={...hero("druid",17),spells:["spell-doc-magic_stone"],
    spellGrants:[{spellId:"spell-doc-magic_stone",sourceType:"class",sourceId:"druid",classId:"druid",mode:"known"}]} as ExportCharacter;
  const attacks=characterAttacks(c,spells);
  assert.equal(attacks.length,1); assert.equal(attacks[0].damageFormula,"1d6+[WIS]");
  assert.equal(attacks[0].damageDisplay,"1d6+3");
  assert.equal(characterAttacks({...c,spells:[]},spells).length,1);
});
test("blade cantrips retain weapon attack and separate conditional damage", () => {
  const c={...hero(),spells:["booming","greenflame"],inventoryOverride:"Кинжал\nКороткий лук"};
  const attacks=characterAttacks(c,spells).filter(a=>a.kind==="cantrip");
  assert.equal(attacks.length,2);
  assert.equal(attacks[0].ability,"dex"); assert.equal(attacks[0].attackBonus,6);
  assert.equal(attacks[0].damageFormula,"1d4+[DEX]+1d8");
  assert.match(attacks[0].note!,/Отдельно: 2d8/);
  assert.equal(lssWeaponAttacks(attacks)[0].ability,"dex");
  assert.equal(characterAttacks({...c,inventoryOverride:""},spells).length,0);
});
test("shillelagh requires suitable equipment and uses casting ability without level scaling", () => {
  const attacks=characterAttacks({...hero("druid",17),spells:["spell-doc-shillelagh"],inventoryOverride:"Боевой посох"},spells).filter(a=>a.kind==="cantrip");
  assert.equal(attacks.length,2);
  for(const a of attacks) { assert.equal(a.damageFormula,"1d8+[WIS]"); assert.equal(a.attackBonus,9); }
});
test("subclass attacks unlock and scale by their own class levels", () => {
  const rogue=characterAttacks(hero("rogue",3,"soulknife"),[]);
  assert.deepEqual(rogue.map(a=>a.damageFormula),["1d6+[DEX]","1d4+[DEX]"]);
  assert.equal(characterAttacks(hero("rogue",2,"soulknife"),[]).length,0);
  const monk=characterAttacks(hero("monk",11,"sun-soul"),[]);
  assert.equal(monk[0].damageFormula,"1d8+[DEX]");
  const c={...hero("artificer",9,"artillerist"),classes:[
    {classId:"artificer",level:3,subclassId:"artillerist",acquiredAtCharacterLevel:1},
    {classId:"wizard",level:6,acquiredAtCharacterLevel:4}]};
  assert.equal(characterAttacks(c,[])[0].damageDisplay,"2d8");
  assert.equal(characterAttacks(hero("artificer",9,"artillerist"),[])[0].damageDisplay,"3d8");
});
test("drake attack uses its Strength +3 and character PB, not ranger Wisdom", () => {
  const c=hero("ranger",7,"drakewarden");
  const a=characterAttacks({...c,abilities:{...c.abilities,wis:8}},[])[0];
  assert.equal(a.attackBonus,6);
  assert.equal(a.damageFormula,"1d6+[PB]+1d6");
  assert.equal(lssWeaponAttacks([a])[0].modBonus.value,2);
});
