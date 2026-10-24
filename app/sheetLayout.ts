export const sheetGroups = ['skills','inventory','features','attacks'] as const;
export type SheetGroup = typeof sheetGroups[number];
export type SheetLayout = {
  sizes:Record<SheetGroup,number>;
  visible:Record<'weapon'|'cantrip'|'spell'|'feature'|'notes'|'hit'|'damage'|'spellNumbers'|'notice',boolean>;
  hiddenAttacks:string[];
};
export const defaultSheetLayout:SheetLayout = {
  sizes:{skills:100,inventory:100,features:100,attacks:100},
  visible:{weapon:true,cantrip:true,spell:true,feature:true,notes:true,hit:true,damage:true,spellNumbers:true,notice:false},
  hiddenAttacks:[],
};
export function normalizeSheetLayout(value:unknown):SheetLayout {
  const raw=(value && typeof value==='object'?value:{}) as Partial<SheetLayout>;
  return {
    sizes:Object.fromEntries(sheetGroups.map(key=>{const n=raw.sizes?.[key];return [key,typeof n==='number' && Number.isFinite(n)?Math.max(70,Math.min(160,Math.round(n/10)*10)):100];})) as SheetLayout['sizes'],
    visible:Object.fromEntries(Object.entries(defaultSheetLayout.visible).map(([key,fallback])=>[key,typeof raw.visible?.[key as keyof SheetLayout['visible']]==='boolean'?raw.visible[key as keyof SheetLayout['visible']]:fallback])) as SheetLayout['visible'],
    hiddenAttacks:Array.isArray(raw.hiddenAttacks)?[...new Set(raw.hiddenAttacks.filter((id):id is string=>typeof id==='string'))].slice(0,500):[],
  };
}
/** Place each card below the shortest contiguous set of columns it can occupy. */
export function packSheetPanels(panels:{span:number;height:number}[],columns=12,gap=10) {
  const bottoms=Array(columns).fill(0) as number[];
  return panels.map(panel=>{
    const span=Math.max(1,Math.min(columns,Math.round(panel.span)));
    let start=0,top=Infinity;
    for(let i=0;i<=columns-span;i++) {
      const y=Math.max(...bottoms.slice(i,i+span));
      if(y<top){start=i;top=y;}
    }
    const height=Math.max(1,Math.ceil(panel.height));
    for(let i=start;i<start+span;i++)bottoms[i]=top+height+gap;
    return {column:start+1,row:Math.floor(top)+1,span,height};
  });
}
