import { newHomebrew, type HomebrewElement } from './homebrew';
import { homebrewExportClosure } from './homebrewEngine';

/** Clone the whole dependency graph, including IDs embedded in interactive text. */
export function copyHomebrew(root: HomebrewElement, library: HomebrewElement[]) {
  const closure = homebrewExportClosure(root, library);
  const ids = new Map<string, string>();
  const collect = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(collect); return; }
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'id' || key === 'packId') && typeof child === 'string' && (key === 'packId' || child.startsWith('hb:')) && !ids.has(child)) {
        ids.set(child, newHomebrew('ability').id);
      }
      collect(child);
    }
  };
  for (const element of closure) {
    collect(element);
    ids.set(element.id, newHomebrew(element.type).id);
  }
  const pattern = new RegExp([...ids.keys()].sort((a,b)=>b.length-a.length).map(id=>id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'), 'g');
  const remap = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replace(pattern, id => ids.get(id)!);
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key.replace(pattern, id => ids.get(id)!), remap(child)]));
    return value;
  };
  const elements = closure.map(element => {
    const copy = remap(element) as HomebrewElement;
    return { ...copy, uid: copy.id, updatedAt: new Date().toISOString(), ...(element.id === root.id ? { name: root.name + ' — копия' } : {}) };
  });
  return { root: elements.find(element => element.id === ids.get(root.id))!, related: elements.filter(element => element.id !== ids.get(root.id)) };
}
