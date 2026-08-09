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
  resources: [{ name: "Второе дыхание", current: 1, max: 1 }],
  classFeatures: [{ level: 5, name: "Дополнительная атака", description: "Действием Атака совершите две атаки вместо одной." }, { level: 2, name: "Всплеск действий", description: "Получите дополнительное действие; применение восстанавливается после отдыха." }],
  raceFeatures: [{ name: "Тёмное зрение", description: "Видит в темноте в пределах 60 футов." }],
  featFeatures: [{ name: "Страж", description: "Реакцией атакуйте врага, который атакует союзника рядом с вами." }],
  backgroundFeature: { name: "Народное гостеприимство", description: "Простые люди помогают герою." },
  equipment: ["Кольчуга", "Щит", "Боевой топор"],
  personality: { traits: "Спокоен в опасности.", ideals: "Справедливость.", bonds: "Защищает родной дом.", flaws: "Упрям." },
  spellSlots: [],
  spells: [],
};

const fighter = renderToStaticMarkup(<PdfCharacterSheet {...base} />);
assert.equal((fighter.match(/class="pdf-page(?: |")/g) || []).length, 3, "A compact non-caster sheet uses a primary, class, and life page");
assert.doesNotMatch(fighter, /Подготовлено/, "The prepared column is wizard-only");
assert(fighter.indexOf("Дополнительная атака") < fighter.indexOf("Всплеск действий"), "Extra Attack must be pinned above ordinary level order");
assert.match(fighter, /Черты и происхождение/, "Origin information must fill the primary page");

const wizard = renderToStaticMarkup(<PdfCharacterSheet {...base}
  identity={{ ...base.identity, className: "Волшебник", level: 5 }}
  classId="wizard"
  spellAbility="Интеллект"
  spellSaveDc={15}
  spellAttackBonus={7}
  spellSlots={[4, 3, 2]}
  spells={[{ id: "firebolt", name: "Огненный снаряд", source: "PHB", description: "Огненный заговор.", level: 0, school: "Воплощение", classes: ["wizard"], prepared: false, alwaysPrepared: false }, { id: "shield", name: "Щит", source: "PHB", description: "Защитное заклинание.", level: 1, school: "Ограждение", classes: ["wizard"], prepared: true, alwaysPrepared: false }]}
/>);
assert.equal((wizard.match(/class="pdf-page(?: |")/g) || []).length, 4, "A compact caster sheet adds a spell page");
assert.match(wizard, /Подготовлено/);
assert.match(wizard, /Огненный снаряд/);
assert.match(wizard, /Книга заклинаний/);

const overflowing = renderToStaticMarkup(<PdfCharacterSheet {...base}
  classFeatures={Array.from({ length: 30 }, (_, index) => ({ level: index + 1, name: `Способность ${index + 1}`, description: "Длинное механическое описание способности с действием, спасброском, уроном, восстановлением после отдыха и важными ограничениями применения." }))}
/>);
assert((overflowing.match(/pdf-class-page/g) || []).length > 1, "Long class feature lists must create continuation pages");
assert.match(overflowing, /продолжение/, "Continuation pages must be clearly labelled");

console.log("PDF sheet structure, page count, ordering, and wizard preparation column are correct.");
