export type HomebrewType = 'ability'|'feat'|'item'|'spell'|'proficiency'|'race'|'subrace'|'class'|'subclass'|'background'|'resource'|'attack'|'table'|'note'|'pack';
export type HBAbility = 'str'|'dex'|'con'|'int'|'wis'|'cha';
export type HBEffect = { type: string; value?: number|string; ability?: string; skill?: string; mode?: string; id?: string; group?: string; damage?: string; condition?: string; sense?: string; range?: number; formula?: string; when?: string; level?: number };
export type HBResource = { id:string; name:string; max:number|string; restore:string[]; showOnSheet?:boolean; level?:number; when?:string };
export type HBAttack = { id:string; name:string; ability:HBAbility; proficient:boolean; bonus?:number|string; damage:{formula:string;type:string}[]; actionType?:string; range?:string; saveAbility?:HBAbility; saveDc?:string; level?:number; when?:string; cost?:{resource:string;amount:number} };
export type HBChoice = { id:string; name:string; type:string; count:number; from:string[]; level?:number; choiceGroup?:string; uniqueAcrossGroup?:boolean };
export type HBRequirement = { type:'selected_feature'; id:string; label?:string };
export type HBSpellGrant = { spellId:string; level:number; mode?:'known'|'always-prepared'; countsAgainstKnown?:boolean; uses?:number; recovery?:'short_or_long'|'long' };
export type HBAction = { id:string; name:string; actionType:string; cost?:{resource:string;amount:number}; description?:string };
export type HBProgression = { type:'feature'|'resource'|'attack'|'spell'|'subclass'|'asi_or_feat'|'choice'; id?:string };
export type HBClassFeature = { id:string; level:number; name:string; description:string; effects?:HBEffect[]; resources?:HBResource[]; attacks?:HBAttack[] };
export type HomebrewElement = {
 id:string; uid?:string; schemaVersion?:2; type:HomebrewType; name:string; description:string; updatedAt:string; characterId?:string;
 summary?:string; tags?:string[]; version?:string; source?:{kind:string;packId?:string;author?:string;url?:string}; icon?:string;
 features?:HBClassFeature[]; spellList?:string[]; spellGrants?:HBSpellGrant[];
 effects?:HBEffect[]; resources?:HBResource[]; attacks?:HBAttack[]; actions?:HBAction[]; choices?:HBChoice[]; references?:string[];
 requirements?:HBRequirement[]; level?:number; school?:string; castingTime?:string; concentration?:boolean; ritual?:boolean;
 range?:string; duration?:string; components?:string; materials?:string; higherLevels?:string; spellClasses?:string[];
 hitDie?:string; primaryAbility?:HBAbility; savingThrows?:HBAbility[]; skillChoices?:{count:number;from:string[]};
 equipment?:string[]; startingGold?:string; multiclass?:{requirements:{ability:HBAbility;min:number}[];effects?:HBEffect[]};
 subclass?:{chooseAtLevel:number;featureLevels?:number[]}; advancement?:Record<string,HBProgression[]>; parentClassId?:string; parentRaceId?:string;
 spellcasting?:{mode:'none'|'full'|'half'|'third'|'pact'|'custom';ability:HBAbility;selection?:'known'|'prepared'|'spellbook';recovery?:'long'|'short_or_long';cantrips?:number[];known?:number[];preparedFormula?:string;slots?:Record<string,number[]>};
 size?:string; speed?:Partial<Record<'walk'|'fly'|'swim'|'climb',number>>; itemType?:string; rarity?:string; weight?:number; price?:number; attunement?:boolean;
 table?:{columns:string[];rows:string[][]};
 rows?:{range:string;text:string}[]; die?:string; entities?:string[];
};
export type HomebrewLibrary = { version:1|2; schemaVersion?:2; elements:HomebrewElement[] };
export const emptyHomebrewLibrary:HomebrewLibrary = {version:2,schemaVersion:2,elements:[]};
export const homebrewTypeLabels:Record<HomebrewType,string> = {ability:'Способность',feat:'Черта',item:'Предмет',spell:'Заклинание',proficiency:'Владение',race:'Раса',subrace:'Подраса',class:'Класс',subclass:'Подкласс',background:'Предыстория',resource:'Ресурс',attack:'Атака',table:'Таблица',note:'Заметка',pack:'Пак'};
export function normalizeHomebrewLibrary(value:Partial<HomebrewLibrary>|null|undefined):HomebrewLibrary {
 const types=new Set(Object.keys(homebrewTypeLabels));
 const elements=(Array.isArray(value?.elements)?value.elements:[]).filter(e=>e&&typeof e.id==='string'&&types.has(e.type)&&typeof e.name==='string'&&typeof e.description==='string').map(e=>({...e,schemaVersion:2 as const,uid:e.uid||e.id,updatedAt:e.updatedAt||new Date(0).toISOString(),effects:e.effects||[],resources:e.resources||[],attacks:e.attacks||[],actions:e.actions||[],choices:e.choices||[]}));
 return {version:2,schemaVersion:2,elements};
}
export function newHomebrew(type:HomebrewType,name=''):HomebrewElement {
 const uid=globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
 return {schemaVersion:2,uid,id:`hb:my:${type}:${uid}`,type,name,description:'',updatedAt:new Date().toISOString(),version:'1.0.0',tags:[],effects:[],resources:[],attacks:[],actions:[],choices:[],advancement:{},...(type==='class'?{hitDie:'d8',primaryAbility:'int' as const,savingThrows:['int','wis'] as HBAbility[],subclass:{chooseAtLevel:3},skillChoices:{count:2,from:[]}}:{})};
}
export const effectTypes:Record<string,string>={ability_bonus:'Бонус характеристики',ability_minimum:'Минимум характеристики',ac_bonus:'Бонус КД',ac_formula:'Формула КД',hp_bonus:'Бонус хитов',hp_per_level:'Хиты за уровень',speed_bonus:'Бонус скорости',movement_mode:'Скорость передвижения',initiative_bonus:'Бонус инициативы',initiative_advantage:'Преимущество инициативы',saving_throw_proficiency:'Владение спасброском',saving_throw_bonus:'Бонус спасброска',skill_proficiency:'Владение навыком',skill_expertise:'Экспертность',skill_bonus:'Бонус навыка',passive_bonus:'Бонус пассивного навыка',weapon_proficiency:'Владение оружием',weapon_group_proficiency:'Группа оружия',armor_proficiency:'Владение доспехами',tool_proficiency:'Владение инструментом',language:'Язык',damage_resistance:'Сопротивление',damage_immunity:'Иммунитет урону',damage_vulnerability:'Уязвимость',condition_immunity:'Иммунитет состоянию',sense:'Чувство',grant_feature:'Выдать способность',grant_spell:'Выдать заклинание',grant_attack:'Выдать атаку',grant_resource:'Выдать ресурс'};
export const damageTypes=['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'];
export const conditionIds=['blinded','charmed','deafened','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious','exhaustion'];
