# HeroList — handoff в новый workflow

**Дата:** 24.09.2026  
**Репозиторий:** `ThrandenSeverest/list-geroya-5e`  
**Ветка:** `main`  
**Правила:** D&D 5e 2014  
**Базовый аудит:** `HeroList_DnD5e_Audit_2026-09-23` (исходно проверял `f2833474c34a51795ab24e96940d37dee48958cc`).

## 0. Состояние на момент передачи

Последний production `dist` после текущего блока синхронизирован коммитом:

- `bd413a52e31f46e922a7be50119b7174958ceeae` — `build: sync precompiled dist`.

Последний исходный коммит, прошедший полный Verify HeroList:

- `e4f7863cfdd60a83b4e44bc91a17eb4b72bd368b` — `ci: prevent concurrent dist sync races`.
- GitHub Actions run **#36** завершён со статусом **success**.
- Проверены: precompiled production runtime, `npm ci`, `npm run build`, sync `dist`, Python dependencies и backend pytest.

До восстановления была создана страховочная ветка:

- `backup/pre-recovery-2026-09-24` — состояние до восстановления потерянных локальных коммитов.

### Исправление самого GitHub workflow

Красные промежуточные workflow были вызваны не ошибкой сборки HeroList, а гонкой нескольких параллельных запусков: старый run успевал собрать `dist`, но при `git push` получал `main -> main (fetch first)`, потому что более новый run уже изменил `main`.

В `.github/workflows/verify.yml` теперь:

1. включён `concurrency` с `cancel-in-progress: true`;
2. перед публикацией `dist` выполняется `git fetch origin main`;
3. если `origin/main` уже ушёл вперёд от SHA текущего run, устаревший run завершает sync без ошибки и ничего не публикует;
4. `dist` публикуется только из актуального исходного дерева.

**Не откатывать эту защиту.**

---

## 1. Уже восстановленные изменения из потерянного workflow

Эти задачи уже находятся в `main`; новый workflow не должен делать их заново.

| Коммит | Что сделано |
|---|---|
| `253ac34` | Бонусы характеристик от черт учитываются в превью ASI. |
| `d47fd44` | Экспорты: LSS → Helpmate → **Наш JSON**; Наш JSON крайний справа и основной. |
| `e32569b` | У правой карточки героя убраны перекрывающие слои с иконки класса. |
| `4d11a02` | Убраны три устаревших пункта из «Известных ограничений». |
| `0bb1ea6` | Светлый дизайн логотипа: красный текст, красная плашка, золотой знак. |

---

## 2. Закрытые пункты аудита

### HL-RULE-01 — закрыт функционально

Single-class Paladin/Ranger теперь используют корректную собственную прогрессию ячеек, а не `floor(level / 2)`.

- исправление: `a0d37bc`;
- добавлены регрессионные тесты на основные уровни: `a9335c7`.

**Остаточный test debt:** расширить матрицу Paladin/Ranger на 7, 9 и 17 уровни, как требовал исходный аудит.

### HL-RULE-02 — закрыт по общему пулу

Мобильный лист теперь использует `sharedSpellSlots = resolveSpellSlots(exportCharacter)`, а Pact Magic — отдельный `resolvePactMagic(exportCharacter)`.

- исправление UI: `0c9e43d`.

### HL-RULE-13 — закрыт

LSS больше не вычисляет ячейки из `character.className + character.level`; используется общий `resolveSpellSlots(character)`.

- исправление: `f261fda`.

### HL-RULE-14 — закрыт

LSS Pact Magic теперь вычисляется через реальный Warlock level в `classes`, независимо от стартового класса.

- исправление: `f261fda`.

### HL-RULE-15 — закрыт функционально

Длинный отдых больше не очищает ресурсы с `isLongRest: false`. «Жетоны усопших» Phantom Rogue не должны восстанавливаться длинным отдыхом.

- исправление: `15599ff`.

**Остаточный test debt:** добавить отдельный тест Phantom Rogue 9 / Tokens of the Departed.

### HL-RULE-16 — исправлен только частично

Исправлено:

- общий Spellcasting pool в мобильном листе;
- Pact Magic показывается отдельно и не зависит от активного/стартового класса.

**Остаётся:** мобильный игровой лист всё ещё строит отображаемый список заклинаний вокруг активного `spellRule`/активного класса. Нужно нормально представить заклинания всех классов мультикласса и явно подписывать класс-источник.

---

# 3. ТЕКУЩИЕ НЕИСПРАВЛЕННЫЕ ОШИБКИ САЙТА

Это следующий обязательный блок работ. Это не проблемы GitHub/CI.

## P1 — исправить в первую очередь

### HL-RULE-03 — неверная скорость

**Сейчас:** скорость по-прежнему вычисляется грубыми условиями:

- mobile: dwarf = 25, wood elf = 35, иначе 30;
- LSS: dwarf = 25, иначе 30;
- Helpmate: dwarf = 25, иначе 30.

Из-за этого неверны, среди прочего:

- halfling/gnome 25;
- Air Genasi MPMM 35;
- Mobile +10;
- Fast Movement Barbarian;
- Unarmored Movement Monk;
- ограничения тяжёлой брони;
- другие постоянные racial/class modifiers;
- swim/climb/fly остаются несогласованными между листом и экспортами.

**Что делать:** сделать единую pure function `speedBreakdown(character)` и использовать её в:

1. основном листе;
2. мобильном листе;
3. PDF;
4. Helpmate;
5. LSS.

Функция должна возвращать не только итоговое walk speed, но и понятные источники/условия. Условные бонусы нельзя молча включать как безусловные.

**Минимальные тесты:** 25/30/35; dwarf; halfling; gnome; wood elf; air genasi; Mobile; Barbarian Fast Movement; Monk Unarmored Movement; heavy armor penalty; экспорт тех же персонажей.

---

### HL-RULE-04 — Passive Perception

**Сейчас:** в `app/page.tsx` и Helpmate фактически используется:

`10 + WIS modifier + PB, если есть Perception proficiency`.

Не учитываются:

- Expertise in Perception = 2×PB;
- Observant = +5 passive Perception;
- общая единая логика skill proficiency/expertise.

**Что делать:** вынести расчёт в общую pure function, например `passivePerceptionBreakdown(character)`, опирающуюся на ту же модель skills/expertise, что и лист.

**Минимальные тесты:**

- без владения;
- proficiency;
- Expertise;
- Observant;
- Expertise + Observant;
- одинаковое число в UI/PDF/LSS/Helpmate, если формат поддерживает поле.

---

### HL-RULE-05 — инициатива

**Сейчас:** мобильный лист и экспорт Helpmate по-прежнему используют только DEX modifier.

Не учитываются постоянные модификаторы, перечисленные исходным аудитом:

- Alert +5;
- Bard Jack of All Trades: половина PB к initiative check;
- Harengon: PB;
- Swashbuckler: CHA;
- War Magic: INT;
- другие постоянные эффекты, если они уже поддерживаются каталогом.

**Что делать:** создать `initiativeBreakdown(character)`.

Разделить:

- числовой постоянный итог;
- условные эффекты/advantage/dice — отображать примечанием, а не превращать в постоянное число.

**Минимальные тесты:** baseline DEX, Alert, Jack of All Trades, Harengon, Swashbuckler, War Magic и комбинации, где правила разрешают суммирование.

---

### HL-RULE-06 — владение оружием

**Сейчас:** `characterAttacks()` создаёт найденное оружие с `proficient: true` и всегда добавляет PB к attack roll.

Это неверно для вручную добавленного в инвентарь оружия, которым персонаж не владеет.

**Что делать:**

1. сопоставить weapon definition с `characterProficiencies(character).weapons`;
2. определить simple/martial/category proficiency;
3. если владения нет — не добавлять PB;
4. явно помечать строку атаки как «нет владения».

**Тесты:** владеет конкретным оружием; владеет всей категорией; не владеет; multiclass proficiency; race-granted weapon proficiency.

---

## P2 / следующий слой правил

### HL-RULE-07 — versatile weapon

Сейчас longsword, spear, quarterstaff, trident, battleaxe и другое versatile-оружие имеет только одну damage die.

**Что делать:** добавить `versatileDice` в weapon definitions и либо:

- показывать две строки «1 рука / 2 руки», либо
- дать явный переключатель режима.

Не подменять автоматически одноручный режим двуручным.

---

### HL-RULE-16 — остаток: spell lists мультикласса

Общие ячейки уже исправлены, но список заклинаний в игровом листе ещё не является полноценным multiclass view.

**Что делать:**

- строить списки по каждому spellcasting class;
- подписывать класс-источник;
- отдельно держать общий regular Spellcasting pool;
- отдельно Pact Magic;
- всегда prepared/granted spells не должны терять источник.

---

# 4. Подтверждённые неполноты из аудита, которые ещё не закрыты

## HL-RULE-08 — Armor Class

`armor.ts` уже считает базовые доспехи, shield, часть natural/unarmored defense, Defense style, Warforged и Dual Wielder, но аудит всё ещё актуален для:

- Medium Armor Master (+3 DEX cap);
- Mage Armor;
- Shield spell;
- временных/условных AC effects;
- единообразного обозначения «базовая/постоянная КД» против временных эффектов.

**План:** сначала считать все постоянные поддерживаемые эффекты, затем добавить текстовый список временных эффектов без попытки считать их постоянно активными.

## HL-RULE-09 — неполный каталог авто-атак

`combat.ts` уже имеет вручную заданные weapon/cantrip/subclass attacks, но это не полный перечень природного оружия и классовых/подклассовых атак.

**План:** после исправления HL-RULE-06/07 перейти на более data-driven attack model. До этого в UI явно обозначить, что блок автоматических атак может быть неполным.

## HL-RULE-10 — legacy HP contract

`estimatedHitPoints()` для `hpMode: roll/manual` использует `hpGain` напрямую и не добавляет CON.

Сначала нельзя просто добавить CON: нужно определить, означает ли существующее `hpGain`:

- чистый бросок кости; или
- уже итоговый прирост HP.

**План:** проверить создание/импорт старых персонажей и зафиксировать контракт поля тестом, затем делать миграцию при необходимости.

## HL-RULE-11 — текстовые vs автоматически рассчитанные эффекты

Часть механик есть только в описаниях.

**План:** единый UI-маркер:

- «учтено автоматически»;
- «условный эффект»;
- «требует ручного применения».

Не превращать advantage/resistance/temporary bonuses в постоянные числа.

## HL-RULE-12 — Eldritch Blast

Сейчас на 5+ уровне formula представляется как суммарное `2d10`, `3d10`, `4d10`, а Agonizing Blast складывает CHA×число лучей.

**План:** отображать количество отдельных лучей:

- «2 луча × 1d10 (+CHA каждый при Agonizing Blast)»;
- отдельные attack rolls;
- не представлять это одной атакой для crit/hit logic.

---

# 5. Обязательные тестовые зоны перед следующим релизом

Исходный аудит отдельно отмечал их как test debt, а не как уже доказанные новые баги.

1. **Итоговый лист ↔ PDF ↔ LSS ↔ Helpmate**  
   Один фиксированный персонаж должен давать согласованные HP, AC, speed, saves, skills, spell DC, slots и attacks.

2. **Мультикласс**  
   full + full; full + half; half + half; Eldritch Knight/Arcane Trickster; Warlock + regular caster; разный порядок взятия классов.

3. **Навыки**  
   Expertise, Jack of All Trades, Reliable Talent, Passive Perception/Investigation, Observant.

4. **КД и атаки**  
   невладимое оружие, versatile, finesse STR>DEX и DEX>STR, Archery/Dueling/Thrown style, shield, Medium Armor Master, temporary effects.

5. **Скорость**  
   25/30/35, swim/climb/fly, dwarf/heavy armor, wood elf, air genasi, monk/barbarian, Mobile, экспорт.

6. **Отдых и ресурсы**  
   short/long/no-rest, разные Hit Dice мультикласса, Pact Magic, Phantom Tokens.

---

# 6. Рекомендуемый порядок следующего workflow

Работать небольшими коммитами; после каждого смыслового блока дождаться зелёного Verify HeroList.

### Этап A — derived stats

1. HL-RULE-03: `speedBreakdown()`.
2. HL-RULE-04: passive perception через общую skill/expertise модель.
3. HL-RULE-05: `initiativeBreakdown()`.
4. Подключить функции одновременно к UI, PDF и экспортам.
5. Добавить pure-function regression tests.

### Этап B — attacks

1. HL-RULE-06: weapon proficiency.
2. HL-RULE-07: versatile.
3. HL-RULE-12: Eldritch Blast как отдельные лучи.
4. После этого расширять HL-RULE-09 data-driven атаками.

### Этап C — remaining character sheet consistency

1. Закрыть остаток HL-RULE-16: списки заклинаний всех классов + источник.
2. HL-RULE-08: постоянные AC modifiers + маркировка временных.
3. HL-RULE-11: единая маркировка auto/manual/conditional effects.
4. HL-RULE-10: определить контракт legacy `hpGain`, затем миграция/фикс.

### Этап D — cross-format regression suite

Создать фиксированные character fixtures и сравнивать derived values между:

- desktop sheet;
- mobile sheet;
- PDF;
- LSS;
- Helpmate;
- HeroList native JSON round-trip.

---

# 7. Правила работы с GitHub и dist

1. **Не редактировать файлы внутри `dist` вручную.**
2. Менять исходники и тесты маленькими коммитами в `main`.
3. `Verify HeroList` сам выполняет production build и при необходимости создаёт `build: sync precompiled dist`.
4. Не делать несколько ручных sync-коммитов `dist` подряд.
5. Не удалять защиту от concurrent dist publishing из `.github/workflows/verify.yml`.
6. Перед следующим крупным блоком можно создать backup branch от текущего `main`.
7. Если CI красный — сначала смотреть **какой именно step** упал; старые красные run до `e4f7863` не считать текущей ошибкой проекта.

---

# 8. Безопасность production/deploy

Следовать актуальному `HOSTING_UPDATE.md`.

Критично:

- production должен получать готовый `dist` из `main`;
- на production не собирать frontend вручную;
- сохранять `.env`, `backend/.env`, фактическую SQLite DB и её WAL/SHM, `uploads/`, `saves/`, server configs/secrets;
- не менять production origin без миграции localStorage;
- не добавлять команды, очищающие `list-geroya-character-vault-v1` или `dark-codex-character`;
- после deploy проверить Telegram login и доступ существующего пользователя к персонажам.

---

# 9. Definition of Done для следующего workflow

Следующий workflow нельзя считать завершённым только потому, что `npm run build` проходит.

Для каждого исправленного правила:

1. есть единая функция расчёта, а не несколько копий формулы в UI/export;
2. есть regression tests;
3. desktop/mobile/PDF/export используют одну и ту же derived value;
4. conditional effects не выдаются за всегда активные;
5. Verify HeroList зелёный;
6. свежий `dist` находится в `main`;
7. существующая авторизация и пользовательские данные не затронуты.

---

## Стартовая инструкция новому workflow

> Продолжай HeroList из текущего `main`. Не откатывай уже восстановленные коммиты и CI fix. Сначала прочитай `WORKFLOW_HANDOFF_2026-09-24.md` и исходный аудит. Начни с HL-RULE-03 (единая скорость), затем HL-RULE-04 (Passive Perception), HL-RULE-05 (initiative), после этого HL-RULE-06/07 (weapon proficiency + versatile). Делай небольшие коммиты непосредственно в GitHub, после каждого смыслового блока проверяй Verify HeroList. Не редактируй `dist` вручную: workflow сам синхронизирует production build. Не трогай Telegram auth, данные пользователей, `.env`, DB, uploads/saves.
