import { hbEffects } from "./homebrewEngine";
import type { ExportCharacter } from "./exportFormats";
import { characterLevel, getClassProgress } from "./multiclass";

const modifier = (score: number) => Math.floor((score - 10) / 2);

/** Permanent initiative modifier; roll-specific dice and advantage remain notes. */
export function initiativeBreakdown(character: ExportCharacter) {
  const pb = Math.floor((characterLevel(character) - 1) / 4) + 2;
  const sources: string[] = [];
  const notes: string[] = [];
  let value = modifier(character.abilities.dex);
  sources.push(`Ловкость ${value >= 0 ? "+" : ""}${value}`);
  const add = (amount: number, source: string) => { value += amount; sources.push(`${source} ${amount >= 0 ? "+" : ""}${amount}`); };
  const feats = new Set([...(character.feats || []), ...(character.advancements || []).map(choice => choice.featId)]);
  if (feats.has("alert")) add(5, "Бдительный");
  if (character.race === "harengon") add(pb, "Заячья реакция");
  const bard = getClassProgress(character, "bard");
  const champion = getClassProgress(character, "fighter");
  // Both features apply only to checks that do not already include proficiency.
  // They are alternatives, not two independent additions of the same PB.
  if (character.race !== "harengon") {
    const jack = bard && bard.level >= 2 ? Math.floor(pb / 2) : 0;
    const athlete = champion?.subclassId === "champion" && champion.level >= 7 ? Math.ceil(pb / 2) : 0;
    if (Math.max(jack, athlete)) add(Math.max(jack, athlete), athlete >= jack && athlete ? "Выдающийся атлет" : "Мастер на все руки");
  }
  const rogue = getClassProgress(character, "rogue");
  if (rogue?.subclassId === "swashbuckler" && rogue.level >= 3) add(modifier(character.abilities.cha), "Лихая удаль");
  const wizard = getClassProgress(character, "wizard");
  if (wizard && wizard.level >= 2 && ["warmagic", "chronurgy"].includes(wizard.subclassId || ""))
    add(modifier(character.abilities.int), wizard.subclassId === "warmagic" ? "Тактическая смекалка" : "Хрональная осведомлённость");
  const ranger = getClassProgress(character, "ranger");
  if (ranger?.subclassId === "gloomstalker" && ranger.level >= 3) add(modifier(character.abilities.wis), "Ужасающая засада");
  if (getClassProgress(character, "barbarian")?.level && getClassProgress(character, "barbarian")!.level >= 7)
    notes.push("Дикий инстинкт: преимущество на бросок инициативы");
  if (getClassProgress(character, "paladin")?.subclassId === "watchers" && getClassProgress(character, "paladin")!.level >= 7)
    notes.push("Аура стража: +БМ к инициативе, пока паладин дееспособен и цель в ауре");
  if (getClassProgress(character, "cleric")?.subclassId === "twilight")
    notes.push("Благословение бдительности: преимущество только для выбранного существа до следующего броска");
  for (const row of hbEffects(character, "initiative_bonus")) add(row.value, row.source.name);
  if (hbEffects(character, "initiative_advantage").length) notes.push("Homebrew: преимущество на инициативу");
  return { value, sources, notes };
}

