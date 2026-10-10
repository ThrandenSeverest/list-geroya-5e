import test from 'node:test';
import assert from 'node:assert/strict';
import { allowed, catalogs, normalizeBanList, setBanState, setSourceBan } from '../app/banLists';
import { optionalFeatureId, restrictedCharacter, classOptionId } from '../app/campaignRestrictions';
import { classChoiceGroups } from '../app/classChoices';
import { characterProficiencies } from '../app/proficiencies';
import { characterResources } from '../app/characterResources';
import { documentedClassFeatures } from '../app/featureDetails';
import { isTashaAdditionalSpell } from '../app/characterRules';
import type { ExportCharacter } from '../app/exportFormats';

const hero = { className:'ranger', level:10, useTasha:true, race:'human', background:'sage', abilities:{str:10,dex:14,con:12,int:10,wis:14,cha:10}, classSkills:[], classChoices:{'tce-deft-explorer':['deft-explorer'],'tce-deft-explorer-skill':['Скрытность'],'tce-favored-foe':['favored-foe']}, spells:[], feats:[], asiChoices:[], personality:{} } as unknown as ExportCharacter;

test('old allow lists migrate new categories as allowed and retain distinct names and ids',()=>{
  const first=normalizeBanList({version:2,name:'Кампания А',mode:'allow',categories:{races:['human']}});
  const second=normalizeBanList({version:2,name:'Кампания Б',mode:'deny',categories:{}});
  assert.notEqual(first.id,second.id);
  assert.equal(allowed(first,'optionalFeatures',catalogs.optionalFeatures[0].id),true);
  assert.equal(normalizeBanList(first).id,first.id);
  assert.equal(allowed(first,'races','elf'),false);
});
test('source restrictions work across categories and allow exceptions in both modes',()=>{
  for(const mode of ['deny','allow']) {
    const list=setSourceBan(normalizeBanList({mode}), 'XGE',true);
    for(const category of ['spells','subclasses','feats'] as const) {
      const option=catalogs[category].find(option=>option.source==='XGE');
      assert.ok(option);
      assert.equal(allowed(list,category,option.id),false);
      assert.equal(allowed(setBanState(list,category,[option.id],false),category,option.id),true);
    }
  }
});
test('individual Tasha ban removes ranger expertise and choice group without erasing stored state',()=>{
  const restricted=restrictedCharacter({...hero,bannedOptionalFeatures:[optionalFeatureId('ranger','Искусный исследователь (TCoE)')]});
  assert.equal(classChoiceGroups(restricted).some(group=>group.key==='tce-deft-explorer'),false);
  assert.equal(restricted.classChoices?.['tce-deft-explorer'],undefined);
  assert.deepEqual(hero.classChoices?.['tce-deft-explorer'],['deft-explorer']);
  assert.ok(classChoiceGroups(restricted).some(group=>group.key==='tce-favored-foe'));
});
test('individual ban reaches sheet text and resource pools through canonical aliases',()=>{
  const id=optionalFeatureId('cleric','Праведное восстановление');
  const cleric={...hero,className:'cleric',bannedOptionalFeatures:[id]};
  assert.equal(characterResources(cleric).some(resource=>resource.key==='harness-divine-power'),false);
  const blocked=optionalFeatureId('monk','Выбранное оружие');
  assert.equal(documentedClassFeatures('monk',undefined,true,[],[],[],[blocked]).some(feature=>feature.name==='Выделенное оружие (TCE)'),false);
});
test('class option bans are scoped to class and remove only that option',()=>{
  const fighter=restrictedCharacter({...hero,className:'fighter',classChoices:{'fighting-style':['archery']},bannedClassOptions:[classOptionId('fighter','fighting-style','archery')]});
  const group=classChoiceGroups(fighter).find(group=>group.key==='fighting-style');
  assert.ok(group && group.options.length>0);
  assert.equal(group.options.some(option=>option.id==='archery'),false);
  assert.deepEqual(fighter.classChoices?.['fighting-style'],[]);
});
test('TCE source ban controls expanded spells separately from optional feature toggle',()=>{
  const list=setSourceBan(normalizeBanList({}), 'TCE',true);
  assert.equal(allowed(list,"optionalFeatures",optionalFeatureId("ranger","Искусный исследователь")),false);
  const exception = setBanState(list,"optionalFeatures",[optionalFeatureId("ranger","Искусный исследователь")],false);
  assert.equal(allowed(exception,"optionalFeatures",optionalFeatureId("ranger","Искусный исследователь")),true);
  assert.equal(isTashaAdditionalSpell({...hero,tceFullBanned:true},'entangle'),false);
  assert.equal(isTashaAdditionalSpell({...hero,useTasha:false},'entangle'),true);
  assert.equal(isTashaAdditionalSpell({...hero,bannedOptionalFeatures:['ranger:дополнительные заклинания следопыта']},'entangle'),false);
});
