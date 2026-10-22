import { hbEffects } from "./homebrewEngine";
import type { ExportCharacter } from "./exportFormats";
import { selectedEquipment } from "./equipment";
import { isShieldItem } from "./adventure";
import { characterLevel, getClassProgress, getClassLevel, normalizedLevelHistory, orderedCharacterClasses } from "./multiclass";

const modifier = (score: number) => Math.floor((score - 10) / 2);

function hasItem(items: string[], pattern: RegExp) {
  return items.some(item => pattern.test(item));
}

function hasFeat(character: ExportCharacter, featId: string) {
  return (character.advancements || []).some(choice => choice.featId === featId) || (character.feats || []).includes(featId);
}

export type ArmorClassBreakdown = {
  value: number;
  base: string;
  bonuses: string[];
  conditions: string[];
  sources: Array<{ id: string; base: string; value: number }>;
  selectedSource: string;
};

export function armorClassBreakdown(character: ExportCharacter): ArmorClassBreakdown {
  const items = character.inventoryOverride === undefined ? selectedEquipment(character)
    : character.inventoryOverride.split(/\n|\s*·\s*/).map(item => item.trim()).filter(Boolean);
  const dex = modifier(character.abilities.dex);
  const con = modifier(character.abilities.con);
  const wis = modifier(character.abilities.wis);
  const equipped = character.adventure?.inventory.filter(i=>i.equipped && i.quantity>0);
  const shield = equipped ? equipped.some(isShieldItem) : hasItem(items, /(?:^|\s)(?:деревянный\s+)?щит(?:$|\s)/i);

  const armors: Array<{ pattern: RegExp; ac: number; dex: "full" | "max2" | "none"; name: string }> = [
    { pattern: /ст[её]ган(?:ый|ая) доспех/i, ac: 11, dex: "full", name: "Стёганый доспех" },
    { pattern: /колечн(?:ый|ая) доспех/i, ac: 14, dex: "none", name: "Колечный доспех" },
    { pattern: /полулаты/i, ac: 15, dex: "max2", name: "Полулаты" },
    { pattern: /(?:^|\s)латы(?:$|\s)/i, ac: 18, dex: "none", name: "Латы" },
    { pattern: /наборн(?:ый|ая) доспех/i, ac: 17, dex: "none", name: "Наборный доспех" },
    { pattern: /кольчуга/i, ac: 16, dex: "none", name: "Кольчуга" },
    { pattern: /кольчат(?:ый|ая) доспех/i, ac: 14, dex: "none", name: "Кольчатый доспех" },
    { pattern: /нагрудник/i, ac: 14, dex: "max2", name: "Кираса" },
    { pattern: /чешуйчат/i, ac: 14, dex: "max2", name: "Чешуйчатый доспех" },
    { pattern: /кольчужн(?:ая|ый) рубах/i, ac: 13, dex: "max2", name: "Кольчужная рубаха" },
    { pattern: /шкурн(?:ый|ая) доспех/i, ac: 12, dex: "max2", name: "Шкурный доспех" },
    { pattern: /прокл[её]панн(?:ая|ый) кож/i, ac: 12, dex: "full", name: "Проклёпанная кожа" },
    { pattern: /кожан(?:ый|ая) доспех/i, ac: 11, dex: "full", name: "Кожаный доспех" },
  ];
  const worn = equipped
    ? armors.find(armor => equipped.some(i=>!isShieldItem(i) && hasItem([i.catalogName||i.name],armor.pattern)))
    : armors.find(armor => hasItem(items, armor.pattern));
  const mediumArmorMaster = hasFeat(character, "medium-armor-master");
  let value = 10 + dex;
  let base = `Без доспеха: 10 + Ловкость (${dex >= 0 ? "+" : ""}${dex})`;
  let wearingArmor = false;

  const candidates: Array<{id:string;value:number;base:string;wearingArmor:boolean}> = [];
  if (!worn) candidates.push({id:"unarmored",value,base,wearingArmor:false});
  if (!worn && character.race === "tortle") candidates.push({id:"tortle",value:17,base:"Природный панцирь: 17",wearingArmor:false});
  if (!worn && character.race === "lizardfolk") candidates.push({id:"lizardfolk",value:13+dex,base:"Природный доспех: 13 + Ловкость",wearingArmor:false});
  if (!worn && getClassProgress(character, "sorcerer")?.subclassId === "draconic") candidates.push({id:"draconic",value:13+dex,base:"Драконья устойчивость: 13 + Ловкость",wearingArmor:false});
  const unarmoredSource = normalizedLevelHistory(character).find(entry => entry.classId === "monk" || entry.classId === "barbarian")?.classId;
  if (!worn && unarmoredSource === "monk" && !shield && getClassLevel(character, "monk"))
    candidates.push({id:"monk",value:10+dex+wis,base:"Защита без доспехов монаха: 10 + Ловкость + Мудрость",wearingArmor:false});
  if (!worn && unarmoredSource === "barbarian" && getClassLevel(character, "barbarian"))
    candidates.push({id:"barbarian",value:10+dex+con,base:"Защита без доспехов варвара: 10 + Ловкость + Телосложение",wearingArmor:false});
  if (!worn) for (const row of hbEffects(character, "ac_formula"))
    candidates.push({id:`homebrew:${row.source.id}`,value:row.value,base:`${row.source.name}: формула КД ${row.value}`,wearingArmor:false});
  if (worn) {
    const dexCap = mediumArmorMaster ? 3 : 2;
    const dexBonus = worn.dex === "full" ? dex : worn.dex === "max2" ? Math.min(dexCap,dex) : 0;
    candidates.push({id:"armor",value:worn.ac+dexBonus,base:`${worn.name}: ${worn.ac}${worn.dex === "full" ? " + Ловкость" : worn.dex === "max2" ? ` + Ловкость (макс. +${dexCap})` : ""}`,wearingArmor:true});
  }
  const stylesForSelection = new Set([...(character.classChoices?.["fighting-style"] || []),...orderedCharacterClasses(character).flatMap(entry => entry.choiceValues?.["fighting-style"] || [])]);
  const optimal = candidates.reduce((best,next)=>{
    const score=(candidate:typeof next)=>candidate.value+(candidate.wearingArmor&&stylesForSelection.has("defense")?1:0)+(candidate.wearingArmor&&character.race==="warforged"?1:0);
    return score(next)>score(best)?next:best;
  });
  const selected = candidates.find(candidate=>candidate.id===character.adventure?.acSource) || optimal;
  value=selected.value;base=selected.base;wearingArmor=selected.wearingArmor;

  const bonuses: string[] = [];
  if (shield) {
    value += 2;
    bonuses.push("щит +2");
  }
  const styles = new Set([
    ...(character.classChoices?.["fighting-style"] || []),
    ...orderedCharacterClasses(character).flatMap(entry => entry.choiceValues?.["fighting-style"] || []),
  ]);
  if (wearingArmor && styles.has("defense")) {
    value += 1;
    bonuses.push("стиль «Оборона» +1");
  }
  if (wearingArmor && character.race === "warforged") {
    value += 1;
    bonuses.push("встроенная защита кованого +1");
  }
  const conditions: string[] = [];
  if (hasFeat(character, "dual-wielder")) conditions.push("Использование двух оружий: +1 КД, пока в каждой руке по отдельному рукопашному оружию.");
  if (hasFeat(character, "defensive-duelist")) conditions.push(`Оборонительный дуэлянт: реакцией +${2 + Math.floor((characterLevel(character) - 1) / 4)} КД против одной рукопашной атаки при фехтовальном оружии.`);
  if (!wearingArmor && character.spells.includes("mage-armor")) conditions.push(`Доспехи мага: если наложены, база КД 13 + Ловкость (${13 + dex}), вместо текущей базы без доспеха.`);
  if (character.spells.includes("shield")) conditions.push("Щит (заклинание): реакцией +5 КД до начала следующего хода.");
  if (character.spells.includes("shield-of-faith")) conditions.push("Щит веры: +2 КД при действующем заклинании и концентрации.");
  if (character.spells.includes("haste")) conditions.push("Ускорение: +2 КД при действующем заклинании и концентрации.");
  for (const row of hbEffects(character, "ac_bonus")) { value += row.value; bonuses.push(`${row.source.name} ${row.value >= 0 ? "+" : ""}${row.value}`); }
  return { value, base, bonuses, conditions, sources:candidates.map(({id,base,value})=>({id,base,value})), selectedSource:selected.id };
}

export function armorClass(character: ExportCharacter) {
  return armorClassBreakdown(character).value;
}

