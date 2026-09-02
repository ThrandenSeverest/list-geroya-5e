import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PdfCharacterSheet, type PdfCharacterSheetProps } from "../app/PdfCharacterSheet";

const base: PdfCharacterSheetProps = {
  identity: { name: "Арден", playerName: "Игрок", className: "Воин", raceName: "Дварф", backgroundName: "Народный герой", alignment: "Доброе", level: 8 },
  classId: "fighter",
  abilities: { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 8 },
  proficiency: 3,
  savingThrows: ["str", "con"],
  proficiencies: { skills: ["Атлетика", "Внимательность"], expertise: [], armor: ["Все доспехи"], weapons: ["Воинское оружие"], tools: ["Инструменты кузнеца"], languages: ["Общий", "Дварфский"] },
  ac: 18,
  initiative: 2,
  speed: 25,
  hitPoints: 76,
  hitDie: 10,
  passivePerception: 14,
  attacks: [{ id: "axe", name: "Боевой топор", kind: "weapon", ability: "str", proficient: true, attackBonus: 7, attackBonusExtra: 0, damageFormula: "1d8+[STR]", damageDisplay: "1d8+4" }],
  resources: [{ name: "Второе дыхание", current: 1, max: 1, isShortRest: true, isLongRest: true }],
  classFeatures: [{ level: 5, name: "Дополнительная атака", description: "Действием Атака совершите две атаки вместо одной." }, { level: 2, name: "Всплеск действий", description: "Получите дополнительное действие; применение восстанавливается после отдыха." }],
  raceFeatures: [{ name: "Тёмное зрение", description: "Видит в темноте в пределах 60 футов." }],
  featFeatures: [{ name: "Страж", description: "Реакцией атакуйте врага, который атакует союзника рядом с вами." }],
  backgroundFeature: { name: "Народное гостеприимство", description: "Простые люди помогают герою." },
  equipment: ["Кольчуга", "Щит", "Боевой топор"],
  currency: { gp: 15, sp: 4, cp: 2, pp: 0 },
  personality: { traits: "Спокоен в опасности.", ideals: "Справедливость.", bonds: "Защищает родной дом.", flaws: "Упрям." },
  spellSlots: [],
  spells: [],
};

const fighter = renderToStaticMarkup(<PdfCharacterSheet {...base} />);
assert.equal((fighter.match(/class="pdf-page(?: |")/g) || []).length, 3, "A compact non-caster sheet uses a primary, class, and life page");
assert.doesNotMatch(fighter, /Подготовлено/, "The prepared column is wizard-only");
assert(fighter.indexOf("Дополнительная атака") < fighter.indexOf("Всплеск действий"), "Extra Attack must be pinned above ordinary level order");
assert.doesNotMatch(fighter, /Черты и происхождение/, "Features must not consume primary-page inventory space");
assert.match(fighter, /Инвентарь и монеты/, "Inventory and coin boxes must fill the primary page");
assert.match(fighter, /Атлетика/, "Skills must be rendered in Russian");
assert.match(fighter, /Спасброски/, "Saving throws must be visually separated");
assert.match(fighter, /pdf-resource-marks/, "Limited class resources must render as printable circle marks");
assert.doesNotMatch(fighter, />1 \/ 1</, "Resource counters must not render as current/max numbers");
const fighterPrimaryPage = fighter.match(/pdf-primary-page[\s\S]*?<\/section>/)?.[0] || "";
assert.doesNotMatch(fighterPrimaryPage, /Ячейки \d+ круга/, "Spell slots by level must not appear on the primary page");

const wizard = renderToStaticMarkup(<PdfCharacterSheet {...base}
  identity={{ ...base.identity, className: "Волшебник", level: 5 }}
  classId="wizard"
  spellAbility="Интеллект"
  spellSaveDc={15}
  spellAttackBonus={7}
  spellSlots={[4, 3, 2]}
  preparedMaximum={8}
  spells={[{ id: "firebolt", name: "Огненный снаряд", source: "PHB", description: "Огненный заговор.", level: 0, school: "Воплощение", classes: ["wizard"], prepared: false, alwaysPrepared: false }, { id: "shield", name: "Щит", source: "PHB", description: "Защитное заклинание.", level: 1, school: "Ограждение", classes: ["wizard"], prepared: true, alwaysPrepared: false }]}
/>);
assert.equal((wizard.match(/class="pdf-page(?: |")/g) || []).length, 5, "A compact caster sheet adds a spellbook page and a spell-card page");
assert.match(wizard, /Подготовлено/);
assert.match(wizard, /Огненный снаряд/);
assert.match(wizard, /Книга заклинаний/);
assert.match(wizard, /pdf-spell-columns/, "The spellbook must use two columns");
assert.match(wizard, /Максимум подготовленных: <b>8<\/b>/, "The wizard page must print the preparation maximum");
assert.match(wizard, /Очистить отметки для печати/, "Prepared marks need an independent print toggle");

const singlePageSpellbook = renderToStaticMarkup(<PdfCharacterSheet {...base}
  identity={{ ...base.identity, className: "Волшебник", level: 20 }}
  classId="wizard"
  spellAbility="Интеллект"
  spellSaveDc={19}
  spellAttackBonus={11}
  spellSlots={[4, 3, 3, 3, 3, 2, 2, 1, 1]}
  preparedMaximum={25}
  spells={Array.from({ length: 55 }, (_, index) => ({ id: `compact-${index}`, name: `Заклинание ${index + 1}`, source: "PHB", description: "Описание.", level: Math.min(9, Math.floor(index / 6)), school: "Воплощение", classes: ["wizard"], prepared: index % 2 === 0, alwaysPrepared: false }))}
/>);
assert.equal((singlePageSpellbook.match(/pdf-spell-page/g) || []).length, 1, "Fifty-five compact spells must stay on one A4 spellbook page");

const fullSpellbook = renderToStaticMarkup(<PdfCharacterSheet {...base}
  identity={{ ...base.identity, className: "Волшебник", level: 20 }}
  classId="wizard"
  spellAbility="Интеллект"
  spellSaveDc={19}
  spellAttackBonus={11}
  spellSlots={[4, 3, 3, 3, 3, 2, 2, 1, 1]}
  spells={Array.from({ length: 70 }, (_, index) => ({ id: index === 0 ? "revivify" : `test-${index}`, name: `Заклинание ${index + 1}`, source: "PHB", description: "Описание.", level: Math.min(9, Math.floor(index / 7)), school: "Воплощение", classes: ["wizard"], ritual: index === 1, prepared: index % 2 === 0, alwaysPrepared: false }))}
/>);
assert((fullSpellbook.match(/pdf-spell-page/g) || []).length > 1, "A long spellbook must create continuation pages");
assert.match(fullSpellbook, /Заклинание 70/, "Ninth-circle and trailing spells must remain visible");
assert.match(fullSpellbook, / Р/, "Rituals must use the compact Р marker after the name");
assert.match(fullSpellbook, /М\*/, "Costly or consumed material components must use М*");
assert.equal((fullSpellbook.match(/pdf-spell-card-page/g) || []).length, 8, "Seventy known spells must create eight 3x3 card pages");
assert.match(fullSpellbook, /pdf-spell-card-grid/, "Known spells must be rendered as printable 3x3 cards");
assert.match(fullSpellbook, /Накладывание/, "Spell cards must include structured casting data");

const overflowing = renderToStaticMarkup(<PdfCharacterSheet {...base}
  classFeatures={Array.from({ length: 30 }, (_, index) => ({ level: index + 1, name: `Способность ${index + 1}`, description: "Длинное механическое описание способности с действием, спасброском, уроном, восстановлением после отдыха и важными ограничениями применения." }))}
/>);
assert((overflowing.match(/pdf-class-page/g) || []).length > 1, "Long class feature lists must create continuation pages");
assert.match(overflowing, /продолжение/, "Continuation pages must be clearly labelled");

console.log("PDF sheet structure, page count, ordering, and wizard preparation column are correct.");
