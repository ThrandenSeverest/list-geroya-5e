import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSheetLayout,normalizeSheetLayout,packSheetPanels } from '../app/sheetLayout';
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
test('panels fill the short centre column and never overlap when fonts change',()=>{
  for(const scale of [0.7,1,1.6]){
    const panels=[{span:4,height:550*scale},{span:3,height:240},{span:5,height:420*scale},{span:3,height:160*scale},{span:5,height:230*scale}];
    const packed=packSheetPanels(panels);
    assert.equal(packed[3].row,251,'Inventory follows the short core column, not the tallest attack card');
    for(let i=0;i<packed.length;i++)for(let j=i+1;j<packed.length;j++){
      const a=packed[i],b=packed[j];
      const overlapX=a.column<b.column+b.span && b.column<a.column+a.span;
      const overlapY=a.row<b.row+b.height && b.row<a.row+a.height;
      assert.ok(!(overlapX&&overlapY));
    }
  }
});
