import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSheetLayout,normalizeSheetLayout } from '../app/sheetLayout';
import { normalizePreferences,themeStyle } from '../app/interfacePreferences';
import { calmPresets,designLayout } from '../app/designPresets';

test('all five built-in designs remain selectable after restoring saved settings',()=>{
  for(const preset of calmPresets){
    const restored=normalizePreferences({activePreset:preset.id,presets:[],rememberDesign:true});
    assert.equal(restored.activePreset,preset.id);
    assert.equal(restored.rememberDesign,true);
    assert.ok(themeStyle(restored,'classic')['--ivory']);
    assert.equal(designLayout([],preset.id),preset.id);
  }
});
test('sheet display preferences reject corrupt values without mutating the defaults',()=>{
  const normalized=normalizeSheetLayout({sizes:{skills:Infinity,inventory:300,features:0},visible:{notes:false,damage:'no'},hiddenAttacks:['dagger',null,'dagger',42]});
  assert.deepEqual(normalized.sizes,{skills:100,inventory:160,features:70,attacks:100});
  assert.equal(normalized.visible.notes,false);assert.equal(normalized.visible.damage,true);
  assert.deepEqual(normalized.hiddenAttacks,['dagger']);
  assert.equal(defaultSheetLayout.sizes.inventory,100);
});
