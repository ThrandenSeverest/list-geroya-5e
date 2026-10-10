import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePreferences,themeStyle,changePaletteRole,paletteRoles } from "../app/interfacePreferences";
test("invalid saved appearance is recovered without losing valid named themes",()=>{
 const prefs=normalizePreferences({zoom:Infinity,font:300,activePreset:"missing",presets:[null,{id:"a",name:"Кампания",base:"parchment",colors:{"8f1821":"#ff0000","17120e":"url(bad)",unknown:"#112233"}},{id:"a",name:"duplicate",colors:{}}]});
 assert.equal(prefs.zoom,125);assert.equal(prefs.font,160);assert.equal(prefs.activePreset,"");assert.equal(prefs.presets.length,1);assert.deepEqual(prefs.presets[0].colors,{"8f1821":"#ff0000"});
});
test("custom accent reaches opaque and translucent colors and survives serialization",()=>{
 const preset=changePaletteRole({id:"a",name:"Своя",base:"parchment",colors:{}},paletteRoles.findIndex(r=>r.token==="selection"),"#123456");
 const prefs=normalizePreferences(JSON.parse(JSON.stringify({zoom:150,font:120,activePreset:"a",presets:[preset]})));
 const style=themeStyle(prefs,"parchment");assert.equal(style["--theme-8f1821"],"#123456");assert.equal(style["--theme-rgb-8f1821"],"18,52,86");assert.equal(style["--interface-font"],1.2);
 assert.equal(themeStyle({...prefs,activePreset:""},"classic")["--theme-8f1821"],undefined);
});
test("text and border palette roles can be edited independently",()=>{
 const text=paletteRoles.findIndex(r=>r.token==="ivory");const border=paletteRoles.findIndex(r=>r.token==="line");
 const preset=changePaletteRole(changePaletteRole({id:"a",name:"Своя",base:"parchment",colors:{}},text,"#111111"),border,"#333333");
 const style=themeStyle({zoom:125,font:100,activePreset:"a",presets:[preset]},"parchment");
 // Separate semantic overrides keep border edits from changing body text.
 assert.equal(style["--line"],"#333333");assert.equal(style["--ivory"],"#111111");
});
