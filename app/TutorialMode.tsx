"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type TutorialSession = {
  slotId: string;
  seenSteps: number[];
  finalShown: boolean;
};

type TutorialContext = {
  expertise: boolean;
  pactMagic: boolean;
  resources: boolean;
  noSpellChoices: boolean;
};

type TutorialCondition = keyof Pick<TutorialContext, "expertise" | "pactMagic" | "resources">;
type TutorialTerm = { name: string; definition: string; condition?: TutorialCondition };
type TutorialParagraph = { text: string; condition?: TutorialCondition };
type TutorialStep = {
  title: string;
  paragraphs: TutorialParagraph[];
  important: string;
  terms: TutorialTerm[];
};

type CharacterSnapshot = Record<string, unknown> | null;

const SESSION_KEY = "herolist-tutorial-session-v1";
const LAUNCHING_KEY = "herolist-tutorial-launching";
const VERSION = "1.4.0";
const VERSION_DATE = "2026-09-15T16:28:00Z";

const tutorialSteps: TutorialStep[] = [
  {
    title: "Раса персонажа",
    paragraphs: [
      { text: "Раса определяет часть врождённых особенностей вашего героя. Она может влиять на скорость, чувства, сопротивления, владения, способности и некоторые значения в листе." },
      { text: "Не нужно искать «правильную» расу для класса. Сначала выберите образ, который вам нравится, а HeroList покажет, какие игровые особенности вы получите." },
    ],
    important: "Читайте не только название расы, но и её особенности — именно они объясняют, чем этот вариант отличается в игре.",
    terms: [
      { name: "Особенность расы", definition: "Правило или способность, которую персонаж получает благодаря выбранной расе." },
      { name: "Скорость", definition: "Расстояние, которое персонаж обычно может пройти за своё перемещение в ход." },
      { name: "Размер", definition: "Игровая категория размера существа. Она может влиять на взаимодействие с пространством и отдельными правилами." },
      { name: "Тёмное зрение", definition: "Способность видеть в темноте на указанной дистанции по правилам этой особенности; это не обычное цветное зрение в полной темноте." },
    ],
  },
  {
    title: "Класс персонажа",
    paragraphs: [
      { text: "Класс определяет основную игровую роль персонажа: чем он обычно занимается в бою, какие способности получает и как развивается с уровнями." },
      { text: "При выборе смотрите не только на образ. Обратите внимание на кость хитов, владения, спасброски и ключевые способности класса. HeroList сам рассчитает связанные значения." },
    ],
    important: "Раса добавляет особенности, но именно класс чаще всего отвечает на вопрос: «Что мой персонаж делает во время игры?»",
    terms: [
      { name: "Кость хитов", definition: "Кость, тип которой задаётся классом. Она связана с запасом хитов и используется для восстановления хитов во время короткого отдыха. У мультикласса могут быть разные кости хитов." },
      { name: "Владение", definition: "Если персонаж обучен оружию, доспеху, навыку, спасброску или инструменту, правила позволяют применять бонус мастерства там, где это предусмотрено." },
      { name: "Спасбросок", definition: "Бросок для сопротивления опасному эффекту: яду, заклинанию, ловушке, контролю и другим угрозам." },
      { name: "Основная характеристика", definition: "Характеристика, от которой особенно часто зависят атаки, заклинания или ключевые способности класса." },
    ],
  },
  {
    title: "Характеристики",
    paragraphs: [
      { text: "У персонажа шесть характеристик: Сила, Ловкость, Телосложение, Интеллект, Мудрость и Харизма. Они определяют, насколько хорошо герой справляется с разными видами действий." },
      { text: "В игре чаще используется не само значение характеристики, а её модификатор: например, Ловкость 16 даёт модификатор +3. Сначала усиливайте характеристики, на которых строятся основные способности вашего класса." },
    ],
    important: "Высокая характеристика полезна только там, где персонаж действительно её использует. Не нужно пытаться сделать все шесть значений одинаково высокими.",
    terms: [
      { name: "Сила (STR)", definition: "Физическая мощь: силовые действия и многие атаки оружием ближнего боя." },
      { name: "Ловкость (DEX)", definition: "Координация и реакция: инициатива, часть КД, скрытность, дальние и фехтовальные атаки." },
      { name: "Телосложение (CON)", definition: "Выносливость: влияет на запас хитов и спасброски концентрации." },
      { name: "Интеллект (INT)", definition: "Знания, память и анализ; важен для некоторых навыков и заклинателей." },
      { name: "Мудрость (WIS)", definition: "Внимательность, интуиция и восприятие; важна для ряда навыков и заклинателей." },
      { name: "Харизма (CHA)", definition: "Сила личности и влияние; важна в общении и для некоторых заклинателей." },
      { name: "Модификатор", definition: "Число, которое чаще всего прибавляется к броску. HeroList рассчитывает его автоматически из значения характеристики." },
      { name: "Проверка характеристики", definition: "Бросок d20, когда персонаж пытается сделать что-то с неопределённым исходом. Мастер выбирает подходящую характеристику." },
      { name: "Point Buy", definition: "Способ распределения характеристик за ограниченный запас очков. Более высокие значения стоят дороже." },
      { name: "Стандартный массив", definition: "Готовый набор 15, 14, 13, 12, 10 и 8, который распределяется между шестью характеристиками." },
    ],
  },
  {
    title: "Предыстория",
    paragraphs: [
      { text: "Предыстория отвечает на вопрос: «Кем мой герой был до начала приключения?» Это может быть солдат, ремесленник, преступник, учёный, моряк и многое другое." },
      { text: "Предыстория даёт реальные игровые преимущества: навыки, владения, языки, инструменты, снаряжение и другие особенности." },
    ],
    important: "Предыстория не диктует характер. Два персонажа с одной предысторией могут быть совершенно разными людьми.",
    terms: [
      { name: "Владение навыком", definition: "Если проверка использует навык, которым персонаж владеет, к броску добавляется бонус мастерства." },
      { name: "Владение инструментом", definition: "Позволяет применять обучение персонажа при подходящих проверках с этим набором инструментов." },
      { name: "Стартовое снаряжение", definition: "Предметы и деньги, с которыми персонаж начинает игру согласно выбранным источникам." },
    ],
  },
  {
    title: "Навыки",
    paragraphs: [
      { text: "Навыки описывают типичные действия: Скрытность, Атлетику, Внимательность, Убеждение и другие. Каждый навык связан с характеристикой." },
      { text: "Если вы владеете навыком, к подходящей проверке добавляется бонус мастерства. Поэтому владение особенно полезно в действиях, которыми вы хотите заниматься регулярно." },
      { text: "Если персонаж получил право на экспертизу, она усиливает уже имеющееся владение и делает героя особенно сильным в выбранном навыке.", condition: "expertise" },
    ],
    important: "Характеристика показывает природную способность, владение — обучение, а экспертиза — особенно высокий уровень подготовки.",
    terms: [
      { name: "Бонус мастерства", definition: "Универсальный бонус обученности. Он добавляется к броскам, в которых персонаж имеет соответствующее владение. Зависит от общего уровня и растёт автоматически." },
      { name: "Владение навыком", definition: "При подходящей проверке навыка персонаж добавляет бонус мастерства к модификатору характеристики." },
      { name: "Экспертиза", definition: "Усиленное владение: для указанного навыка или инструмента бонус мастерства учитывается дважды, если конкретная способность это разрешает.", condition: "expertise" },
      { name: "Проверка навыка", definition: "Обычно это d20 + модификатор подходящей характеристики + бонус мастерства при владении." },
    ],
  },
  {
    title: "Снаряжение",
    paragraphs: [
      { text: "Снаряжение определяет, чем персонаж сражается, как защищается и какие предметы может использовать вне боя." },
      { text: "Оружие влияет на бросок атаки, урон, дистанцию и свойства. Броня и щит влияют на Класс Доспеха — КД." },
    ],
    important: "Владение предметом и сам предмет — разные вещи. Владение говорит, умеет ли герой им пользоваться; снаряжение — есть ли этот предмет у него сейчас.",
    terms: [
      { name: "КД", definition: "Класс Доспеха показывает, насколько трудно попасть по персонажу атакой. Если итог броска атаки равен КД или выше, атака обычно попадает." },
      { name: "Бросок атаки", definition: "Проверка того, попала ли атака по цели. Обычно это d20 + подходящий модификатор характеристики + бонус мастерства при владении атакой." },
      { name: "Урон", definition: "Количество хитов, которое цель теряет после успешной атаки. Урон и шанс попасть — разные показатели." },
      { name: "Кость урона", definition: "Кость, указанная у оружия или эффекта, например d6 или d8. Она задаёт случайную часть урона." },
      { name: "Щит", definition: "Предмет защиты, который при правильном использовании повышает КД; для многих персонажей требуется соответствующее владение." },
    ],
  },
  {
    title: "Уровень персонажа",
    paragraphs: [
      { text: "Уровень показывает, насколько далеко персонаж продвинулся в развитии. С ростом уровня открываются новые классовые способности, подкласс, улучшения характеристик или черты, а иногда заклинания и ресурсы." },
      { text: "Если персонаж остаётся в одном классе, общий уровень и уровень класса совпадают. Мультикласс позволяет распределять уровни между несколькими классами, но заметно усложняет персонажа." },
    ],
    important: "Для первого героя мультикласс не обязателен. Выбирайте второй класс только если понимаете, зачем вам его способности.",
    terms: [
      { name: "Общий уровень", definition: "Сумма уровней всех классов персонажа. От него, среди прочего, зависит бонус мастерства." },
      { name: "Уровень класса", definition: "Количество уровней именно в конкретном классе. Он определяет, какие способности этого класса уже открыты." },
      { name: "Подкласс", definition: "Специализация внутри класса. Она развивает определённый стиль и открывает собственные способности на заданных уровнях." },
      { name: "Мультикласс", definition: "Персонаж с уровнями более чем одного класса. Он получает способности по уровням каждого класса и подчиняется специальным правилам мультиклассирования." },
      { name: "Черта", definition: "Отдельная способность, которую персонаж может получить в тех случаях, когда правила позволяют выбрать черту вместо другого улучшения." },
      { name: "Повышение характеристик", definition: "Возможность увеличить значения характеристик на соответствующем уровне, если класс предоставляет такое улучшение." },
    ],
  },
  {
    title: "Заклинания",
    paragraphs: [
      { text: "Заклинание — отдельная магическая возможность персонажа. Заговоры обычно не требуют ячеек, а большинство заклинаний 1-го круга и выше расходует ячейку подходящего уровня." },
      { text: "Знать или подготовить заклинание — не то же самое, что иметь ячейку. Заклинание определяет, что вы умеете сотворить; ячейка — сколько раз вы можете применять такую магию до восстановления ресурса." },
      { text: "Некоторые мультиклассы имеют отдельную Магию договора. HeroList показывает её ресурс отдельно от обычных ячеек.", condition: "pactMagic" },
    ],
    important: "Список заклинаний отвечает на вопрос «что я могу сделать», а ячейки — «сколько раз я могу сделать это до восстановления».",
    terms: [
      { name: "Заговор", definition: "Заклинание 0-го круга. Обычно его можно применять без расходования ячеек заклинаний." },
      { name: "Круг заклинания", definition: "Уровень силы конкретного заклинания — от 0 до 9. Это не то же самое, что уровень персонажа." },
      { name: "Ячейка заклинаний", definition: "Ограниченный ресурс для применения заклинаний 1-го круга и выше. Ячейки восстанавливаются согласно правилам класса и отдыха." },
      { name: "Известное заклинание", definition: "Заклинание, которым персонаж научился и которое входит в его доступный набор по правилам класса." },
      { name: "Подготовленное заклинание", definition: "Заклинание из доступного списка, выбранное как готовое к применению по правилам класса." },
      { name: "Концентрация", definition: "Требование некоторых длительных заклинаний. Обычно нельзя одновременно концентрироваться более чем на одном таком заклинании." },
      { name: "Сл спасброска", definition: "Число, которое цель должна достичь спасброском, чтобы сопротивляться вашему заклинанию. HeroList рассчитывает его автоматически." },
      { name: "Бонус атаки заклинанием", definition: "Бонус к броску атаки теми заклинаниями, которые требуют броска атаки." },
      { name: "Магия договора", definition: "Отдельный источник ячеек чернокнижника, который может восстанавливаться иначе, чем обычные ячейки заклинаний.", condition: "pactMagic" },
    ],
  },
  {
    title: "Языки и инструменты",
    paragraphs: [
      { text: "Языки определяют, на каких языках персонаж умеет общаться в рамках правил игры. Это может открывать варианты общения и понимания информации без магии или переводчика." },
      { text: "Владение инструментом показывает специальную подготовку: например, работу с воровскими инструментами, ремесленным набором или музыкальным инструментом." },
    ],
    important: "Инструмент не заменяет навык. В конкретной ситуации мастер решает, какая характеристика и какое владение применимы.",
    terms: [
      { name: "Язык", definition: "Язык, которым персонаж владеет. Польза зависит от существ и культур, с которыми он сталкивается в кампании." },
      { name: "Инструмент", definition: "Набор или предмет для специализированной деятельности: ремесла, взлома, игры на инструменте и т. п." },
      { name: "Владение инструментом", definition: "Обучение работе с инструментом. Когда мастер считает владение применимым, персонаж может добавить бонус мастерства по правилам проверки." },
    ],
  },
  {
    title: "Характер персонажа",
    paragraphs: [
      { text: "Здесь вы описываете не способности, а самого героя. Не нужно писать большую биографию — достаточно нескольких коротких идей, которые помогут принимать решения во время игры." },
      { text: "Черты показывают привычное поведение, идеалы — принципы, привязанности — то, что герою дорого, а слабости — то, что действительно может создавать ему проблемы." },
    ],
    important: "Эти поля помогают вам играть персонажа, а не ограничивают его. Герой может меняться по ходу истории.",
    terms: [
      { name: "Черты характера", definition: "Как персонаж обычно ведёт себя, говорит и реагирует." },
      { name: "Идеалы", definition: "Принципы или убеждения, которые направляют решения персонажа." },
      { name: "Привязанности", definition: "Люди, места, обещания, организации или цели, которые для героя особенно важны." },
      { name: "Слабости", definition: "Черта, страх, привычка или убеждение, которое способно реально создавать персонажу проблемы." },
      { name: "Мировоззрение", definition: "Краткий ориентир отношения к порядку, свободе, добру и злу. Это не строгий сценарий и не заменяет личность персонажа." },
    ],
  },
  {
    title: "Итог: прочитайте своего персонажа",
    paragraphs: [
      { text: "Персонаж почти готов. На этом экране HeroList проверяет, не осталось ли обязательных выборов, и собирает основные показатели в один лист." },
      { text: "Для первой игры достаточно уметь быстро найти КД, хиты, инициативу, скорость, основные атаки или заклинания, владения и ключевые способности класса." },
      { text: "Если проверка показывает предупреждение, нажмите на него: HeroList вернёт вас к нужному месту конструктора." },
    ],
    important: "Не пытайтесь запомнить весь лист. Сначала научитесь быстро находить главные числа и свои основные возможности.",
    terms: [
      { name: "КД", definition: "Насколько трудно попасть по вам обычной атакой." },
      { name: "Хиты", definition: "Текущий запас боевой устойчивости персонажа. Урон уменьшает хиты; 0 хитов запускает специальные правила." },
      { name: "Кость хитов", definition: "Ресурс восстановления на коротком отдыхе; тип и количество зависят от уровней классов." },
      { name: "Инициатива", definition: "Бонус к броску, который обычно определяет порядок ходов в начале боя." },
      { name: "Скорость", definition: "Сколько персонаж обычно может переместиться за ход." },
      { name: "Бонус мастерства", definition: "Один общий бонус, который применяется к тем броскам и расчётам, где у персонажа есть соответствующее владение или правило его использует." },
      { name: "Ресурсы", definition: "Ограниченные применения реально имеющихся способностей: ячейки, ярость, кости превосходства, канал божественности и т. п.", condition: "resources" },
    ],
  },
];

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function readSession(): TutorialSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TutorialSession>;
    if (!parsed.slotId) return null;
    return {
      slotId: parsed.slotId,
      seenSteps: Array.isArray(parsed.seenSteps) ? parsed.seenSteps.filter(value => Number.isInteger(value)) : [],
      finalShown: !!parsed.finalShown,
    };
  } catch {
    return null;
  }
}

function writeSession(session: TutorialSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LAUNCHING_KEY);
}

function activeCharacter(): { id: string; character: CharacterSnapshot } {
  try {
    const raw = localStorage.getItem("list-geroya-character-vault-v1");
    if (!raw) return { id: "", character: null };
    const vault = JSON.parse(raw) as {
      activeId?: string;
      slots?: Array<{ id?: string; character?: Record<string, unknown> }>;
    };
    const id = vault.activeId || "";
    const slot = vault.slots?.find(item => item.id === id);
    return { id, character: slot?.character || null };
  } catch {
    return { id: "", character: null };
  }
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function characterCanUseExpertise(character: CharacterSnapshot) {
  if (!character) return false;
  if (Array.isArray(character.expertiseSkills) && character.expertiseSkills.length > 0) return true;
  const classes = Array.isArray(character.classes) && character.classes.length
    ? character.classes as Array<Record<string, unknown>>
    : [{ classId: character.className, level: character.level }];
  if (classes.some(entry =>
    (entry.classId === "rogue" && numberValue(entry.level, 1) >= 1)
    || (entry.classId === "bard" && numberValue(entry.level, 1) >= 3),
  )) return true;
  if (!Array.isArray(character.advancements)) return false;
  return (character.advancements as Array<Record<string, unknown>>).some(choice => {
    const featId = String(choice.featId || "").toLowerCase();
    const featChoices = choice.featChoices && typeof choice.featChoices === "object" ? choice.featChoices as Record<string, unknown> : {};
    return featId.includes("skill-expert") || featId.includes("эксперт") || Object.keys(featChoices).some(key => key.toLowerCase().includes("expertise"));
  });
}

function conditionVisible(condition: TutorialCondition | undefined, context: TutorialContext) {
  return !condition || context[condition];
}

function stepFor(index: number, context: TutorialContext): TutorialStep {
  if (index === 7 && context.noSpellChoices) {
    return {
      title: "Заклинания",
      paragraphs: [{ text: "Ваш персонаж пока не использует заклинания; на этом шаге выбирать ничего не нужно." }],
      important: "Если магия появится позже из класса, подкласса, расы или черты, HeroList покажет соответствующие выборы тогда, когда они станут нужны.",
      terms: [],
    };
  }
  return tutorialSteps[index] || tutorialSteps[0];
}

function patchVersionHistory() {
  document.querySelectorAll<HTMLElement>(".update-history-toggle b").forEach(node => {
    node.textContent = `v${VERSION}`;
  });
  const panel = document.querySelector<HTMLElement>(".update-history-panel");
  if (!panel || panel.querySelector("[data-herolist-14]")) return;
  const article = document.createElement("article");
  article.dataset.herolist14 = "true";
  const row = document.createElement("div");
  const version = document.createElement("strong");
  version.textContent = `v${VERSION}`;
  const time = document.createElement("time");
  time.dateTime = VERSION_DATE;
  time.textContent = new Date(VERSION_DATE).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
  row.append(version, time);
  const list = document.createElement("ul");
  const item = document.createElement("li");
  item.textContent = "Добавлен отдельный режим «Создать с обучением»: 11 контекстных объяснений, справка по терминам и три финальных вопроса о персонаже.";
  list.append(item);
  article.append(row, list);
  panel.querySelector("header")?.after(article);
}

export function TutorialMode() {
  const [homeTarget, setHomeTarget] = useState<HTMLElement | null>(null);
  const [helpTarget, setHelpTarget] = useState<HTMLElement | null>(null);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [introStep, setIntroStep] = useState<number | null>(null);
  const [term, setTerm] = useState<TutorialTerm | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [context, setContext] = useState<TutorialContext>({ expertise: false, pactMagic: false, resources: false, noSpellChoices: false });

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      setHomeTarget(document.querySelector<HTMLElement>(".hero-menu-options"));
      patchVersionHistory();

      const stepButtons = [...document.querySelectorAll<HTMLElement>(".steps .step")];
      const activeStep = stepButtons.findIndex(button => button.classList.contains("active"));
      const snapshot = activeCharacter();
      const session = readSession();
      const workspace = document.querySelector<HTMLElement>(".workspace");
      const active = !!(workspace && session?.slotId && session.slotId === snapshot.id);

      setCurrentStep(activeStep >= 0 ? activeStep : null);
      setTutorialActive(active);
      setHelpTarget(active ? document.querySelector<HTMLElement>(".content-head") : null);
      setContext({
        expertise: characterCanUseExpertise(snapshot.character),
        pactMagic: !!document.body.textContent?.includes("Магия договора"),
        resources: !!document.querySelector(".sheet-resources"),
        noSpellChoices: activeStep === 7 && !document.querySelector(".spell-requirements"),
      });

      if (active && activeStep >= 0 && session && !session.seenSteps.includes(activeStep)) {
        writeSession({ ...session, seenSteps: [...session.seenSteps, activeStep] });
        setIntroStep(activeStep);
      }
    };
    const scheduleSync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    const onDocumentClick = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      const button = element?.closest("button");
      if (!button || button.getAttribute("data-herolist-tutorial-entry") === "true") return;
      const text = normalizeText(button.textContent || "");
      if ((text.startsWith("Создать персонажа") || text.startsWith("Новый персонаж")) && sessionStorage.getItem(LAUNCHING_KEY) !== "1") {
        clearSession();
        setTutorialActive(false);
        setIntroStep(null);
        setTerm(null);
        setFinalOpen(false);
      }
      const checkModal = button.closest(".character-check-modal");
      if (checkModal && text === "Закрыть" && normalizeText(checkModal.textContent || "").includes("Персонаж готов")) {
        const snapshot = activeCharacter();
        const session = readSession();
        if (session && session.slotId === snapshot.id && !session.finalShown) {
          writeSession({ ...session, finalShown: true });
          window.setTimeout(() => setFinalOpen(true), 40);
        }
      }
    };
    document.addEventListener("click", onDocumentClick, true);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, []);

  function launchTutorial() {
    const menu = homeTarget || document.querySelector<HTMLElement>(".hero-menu-options");
    const createButton = menu
      ? [...menu.querySelectorAll<HTMLButtonElement>("button")].find(button => button.getAttribute("data-herolist-tutorial-entry") !== "true" && normalizeText(button.textContent || "").startsWith("Создать персонажа"))
      : undefined;
    if (!createButton) return;
    clearSession();
    sessionStorage.setItem(LAUNCHING_KEY, "1");
    createButton.click();
    window.setTimeout(() => {
      const snapshot = activeCharacter();
      sessionStorage.removeItem(LAUNCHING_KEY);
      if (!snapshot.id) return;
      writeSession({ slotId: snapshot.id, seenSteps: [], finalShown: false });
      setTutorialActive(true);
      const activeStep = [...document.querySelectorAll<HTMLElement>(".steps .step")].findIndex(button => button.classList.contains("active"));
      if (activeStep >= 0) {
        writeSession({ slotId: snapshot.id, seenSteps: [activeStep], finalShown: false });
        setCurrentStep(activeStep);
        setIntroStep(activeStep);
      }
    }, 60);
  }

  function stopTutorial() {
    clearSession();
    setTutorialActive(false);
    setIntroStep(null);
    setTerm(null);
    setFinalOpen(false);
  }

  function finishTutorial() {
    stopTutorial();
  }

  const activeStepModel = currentStep === null ? null : stepFor(currentStep, context);
  const introModel = introStep === null ? null : stepFor(introStep, context);
  const activeTerms = activeStepModel?.terms.filter(item => conditionVisible(item.condition, context)) || [];
  const introParagraphs = introModel?.paragraphs.filter(item => conditionVisible(item.condition, context)) || [];

  return <>
    <style>{`
      .tutorial-helpbar{margin-top:18px;padding:12px 14px;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:color-mix(in srgb,currentColor 4%,transparent)}
      .tutorial-helpbar>strong{margin-right:4px;font-size:.9rem}.tutorial-helpbar>button{min-height:34px;padding:7px 10px;border-radius:9px}.tutorial-helpbar .tutorial-stop{margin-left:auto}
      .tutorial-modal{width:min(680px,calc(100vw - 28px));max-height:min(82vh,760px);overflow:auto}.tutorial-modal h2{margin-bottom:14px}.tutorial-modal p{line-height:1.55}
      .tutorial-important{margin:16px 0;padding:12px 14px;border-left:3px solid currentColor;background:color-mix(in srgb,currentColor 5%,transparent);border-radius:0 9px 9px 0}
      .tutorial-term-grid{display:flex;gap:7px;flex-wrap:wrap;margin:14px 0}.tutorial-term-grid button{padding:7px 10px;border-radius:999px}
      .tutorial-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.tutorial-modal-actions .tutorial-skip{margin-right:auto}
      .tutorial-term-modal{width:min(520px,calc(100vw - 28px))}.tutorial-final-questions{display:grid;gap:10px;margin:16px 0}.tutorial-final-questions article{padding:12px 14px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);border-radius:10px}.tutorial-final-questions strong{display:block;margin-bottom:4px}.tutorial-final-questions p{margin:0}
      @media(max-width:700px){.tutorial-helpbar .tutorial-stop{margin-left:0}.tutorial-modal-actions{flex-wrap:wrap}.tutorial-modal-actions .tutorial-skip{margin-right:0;width:100%}}
    `}</style>

    {homeTarget && createPortal(
      <button data-herolist-tutorial-entry="true" onClick={launchTutorial}>
        <strong>Создать с обучением</strong>
        <span>Тот же конструктор, но с короткими пояснениями на каждом этапе.</span>
      </button>,
      homeTarget,
    )}

    {tutorialActive && helpTarget && activeStepModel && createPortal(
      <div className="tutorial-helpbar" aria-label="Справка обучающего режима">
        <strong>Обучение · шаг {(currentStep || 0) + 1}</strong>
        <button type="button" onClick={() => currentStep !== null && setIntroStep(currentStep)}>? Объяснить этап</button>
        {activeTerms.map(item => <button type="button" key={item.name} onClick={() => setTerm(item)}>? {item.name}</button>)}
        <button type="button" className="tutorial-stop" onClick={stopTutorial}>Пропустить обучение</button>
      </div>,
      helpTarget,
    )}

    {introModel && introStep !== null && <div className="modal-backdrop" role="presentation">
      <section className="warning-modal tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-step-title">
        <small>Обучение · этап {introStep + 1} из 11</small>
        <h2 id="tutorial-step-title">{introModel.title}</h2>
        {introParagraphs.map((paragraph, index) => <p key={index}>{paragraph.text}</p>)}
        <p className="tutorial-important"><b>Важно:</b> {introModel.important}</p>
        {!!introModel.terms.length && <div className="tutorial-term-grid" aria-label="Термины этого этапа">
          {introModel.terms.filter(item => conditionVisible(item.condition, context)).map(item => <button type="button" key={item.name} onClick={() => setTerm(item)}>? {item.name}</button>)}
        </div>}
        <div className="tutorial-modal-actions">
          <button className="tutorial-skip" type="button" onClick={stopTutorial}>Пропустить обучение</button>
          <button className="primary-action" type="button" onClick={() => setIntroStep(null)}>Понятно</button>
        </div>
      </section>
    </div>}

    {term && <div className="modal-backdrop" role="presentation">
      <section className="warning-modal tutorial-term-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-term-title">
        <small>Короткая справка</small>
        <h2 id="tutorial-term-title">{term.name}</h2>
        <p>{term.definition}</p>
        <div className="tutorial-modal-actions"><button className="primary-action" type="button" onClick={() => setTerm(null)}>Понятно</button></div>
      </section>
    </div>}

    {finalOpen && <div className="modal-backdrop" role="presentation">
      <section className="warning-modal tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-final-title">
        <small>Обучение завершено</small>
        <h2 id="tutorial-final-title">Персонаж готов. Теперь поймите, кого вы создали.</h2>
        <p>Ответы не нужно записывать на сайте. Достаточно, чтобы вы сами могли на них ответить.</p>
        <div className="tutorial-final-questions">
          <article><strong>1. В чём моя сила?</strong><p>Что у этого персонажа получается особенно хорошо — игромеханически или как у личности?</p></article>
          <article><strong>2. В чём моя слабость?</strong><p>Что действительно ограничивает его, создаёт проблемы или может быть использовано против него?</p></article>
          <article><strong>3. Что мной движет?</strong><p>Почему этот персонаж идёт в приключение? Чего он хочет добиться, изменить, доказать или защитить?</p></article>
        </div>
        <div className="tutorial-modal-actions"><button className="primary-action" type="button" onClick={finishTutorial}>Открыть персонажа</button></div>
      </section>
    </div>}
  </>;
}
