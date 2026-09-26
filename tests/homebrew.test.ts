import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFormula } from '../app/homebrewFormula';
import { normalizeHomebrewLibrary, type HomebrewElement } from '../app/homebrew';
import { validateHomebrew } from '../app/homebrewValidation';
import { activeHomebrew, bindHomebrewLibrary, homebrewReferencesOnly, homebrewExportClosure, homebrewExportWarning, hbResources } from '../app/homebrewEngine';
import { subclassTemplate, homebrewTableFeatures } from '../app/homebrewTemplates';
import { createNativeCharacterFile } from '../app/characterFiles';
import type { ExportCharacter } from '../app/exportFormats';
import savant from '../app/savantExample.json';
const library=normalizeHomebrewLibrary({elements:savant as HomebrewElement[]});
const base={className:'hb:savant:class:savant',level:5,abilities:{str:10,dex:12,con:12,int:16,wis:14,cha:10},race:'human',raceVariant:'standard',background:'',classSkills:[],spells:[],feats:[],advancements:[],homebrew:{entities:[],activeIds:['hb:savant:class:savant']}} as unknown as ExportCharacter;
test('bounded formulas and rejection of code injection',()=>{
 assert.equal(evaluateFormula('max(1, @mod.int) + 2d6',{values:{'@mod.int':3}}),10);
 for(const code of ['globalThis.alert(1)','@mod.int.constructor','1 / 0','999999d6','min()'])assert.throws(()=>evaluateFormula(code,{values:{'@mod.int':3}}));
});
test('Savant library validates, has nine subclasses and portable dependency closure',()=>{
 assert.deepEqual(validateHomebrew(library.elements),[]);
 assert.equal(library.elements.filter(e=>e.type==='subclass').length,9);
 const cls=library.elements.find(e=>e.id===base.className)!;
 const pack=homebrewExportClosure(cls,library.elements);
 assert.ok(pack.some(e=>e.type==='ability'));
 assert.deepEqual(validateHomebrew(pack),[]);
 assert.deepEqual(Object.keys(subclassTemplate(cls.id,library.elements)),['3','6','10','15']);
});
test('one library supports multiple characters; play state and exports never duplicate definitions',()=>{
 const r:HomebrewElement={id:'hb:test:resource:focus',type:'resource',name:'Фокус',description:'',updatedAt:'',resources:[{id:'hb:test:resource:pool',name:'Фокус',max:3,restore:['short_rest']}]};
 const lib={elements:[...library.elements,r]};
 const a=bindHomebrewLibrary({...base,homebrew:{entities:[],activeIds:[base.className,r.id]},resourceSpent:{'hb:test:resource:pool':2}},lib);
 const b=bindHomebrewLibrary({...base,homebrew:{entities:[],activeIds:[base.className,r.id]},resourceSpent:{}},lib);
 assert.equal(hbResources(a)[0].max,3);assert.equal(b.resourceSpent?.['hb:test:resource:pool'],undefined);
 assert.deepEqual(homebrewReferencesOnly(a).homebrew?.entities,[]);
 assert.deepEqual(createNativeCharacterFile(a).character.homebrew?.entities,[]);
 assert.ok(activeHomebrew(a).some(e=>e.name==='Ускоренные рефлексы'));
 assert.match(homebrewExportWarning(a),/Класс: Савант/);
 assert.equal(homebrewExportWarning({...base,className:'fighter',homebrew:undefined}),'');
});
test('subclass templates follow 2014 parent class and PDF tables repeat headers',()=>{
 assert.deepEqual(Object.keys(subclassTemplate('official:class:fighter',[])),['3','7','10','15','18']);
 assert.deepEqual(Object.keys(subclassTemplate('official:class:wizard',[])),['2','6','10','14']);
 const table={id:'hb:test:table:progress',type:'table',name:'Развитие',description:'',updatedAt:'',table:{columns:['Уровень','Бонус'],rows:Array.from({length:20},(_,i)=>[String(i+1),'+2'])}} as HomebrewElement;
 const features=homebrewTableFeatures([table]);assert.equal(features.length,3);
 assert.ok(features.every(f=>f.description.includes('| Уровень | Бонус |')));
 assert.ok(validateHomebrew([{...table,table:{columns:['a'],rows:[['a','b']]}}]).length);
 assert.ok(validateHomebrew([null] as unknown as HomebrewElement[]).length);
});
