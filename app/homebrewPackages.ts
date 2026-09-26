import type { HomebrewElement } from './homebrew';

export type HomebrewPackage = {
  id: string;
  name: string;
  root: HomebrewElement;
  members: HomebrewElement[];
  counts: Partial<Record<HomebrewElement['type'], number>>;
};

/**
 * Homebrew still uses stable entities internally, but the library presents a
 * class (or another root) and all of its implementation details as one pack.
 * This keeps old v2 JSON compatible while avoiding dozens of peer-level cards.
 */
export function homebrewPackages(elements: HomebrewElement[]): HomebrewPackage[] {
  const byId = new Map(elements.map(element => [element.id, element]));
  const classes = elements.filter(element => element.type === 'class');
  const owner = new Map<string, string>();
  const packRoot = new Map<string, string>();

  for (const element of classes) {
    owner.set(element.id, element.id);
    if (element.source?.packId) packRoot.set(element.source.packId, element.id);
  }

  // Explicit pack metadata is the strongest signal and covers imported packs.
  for (const element of elements) {
    const root = element.source?.packId && packRoot.get(element.source.packId);
    if (root) owner.set(element.id, root);
  }

  // Resolve structural ownership. Repeat because a subclass may itself own
  // referenced choices and features.
  for (let pass = 0; pass < elements.length; pass += 1) {
    let changed = false;
    for (const element of elements) {
      if (owner.has(element.id)) continue;
      const candidates = [
        element.parentClassId,
        ...(element.spellClasses || []),
        ...(element.references || []),
      ].filter((id): id is string => !!id);
      const root = candidates.map(id => owner.get(id) || (byId.get(id)?.type === 'class' ? id : undefined)).find(Boolean);
      if (root) { owner.set(element.id, root); changed = true; }
    }
    for (const parent of elements) {
      const root = owner.get(parent.id);
      if (!root) continue;
      const childIds = [
        ...(parent.choices || []).flatMap(choice => choice.from),
        ...Object.values(parent.advancement || {}).flatMap(rows => rows.map(row => row.id).filter((id): id is string => !!id)),
      ];
      for (const id of childIds) if (byId.has(id) && !owner.has(id)) { owner.set(id, root); changed = true; }
    }
    if (!changed) break;
  }

  const roots = elements.filter(element => owner.get(element.id) === element.id || !owner.has(element.id));
  return roots.map(root => {
    const rootId = owner.get(root.id) || root.id;
    const members = elements.filter(element => (owner.get(element.id) || element.id) === rootId);
    const counts: HomebrewPackage['counts'] = {};
    for (const member of members) counts[member.type] = (counts[member.type] || 0) + 1;
    return { id: rootId, name: root.name, root, members, counts };
  });
}

export function homebrewPackageFor(element: HomebrewElement, elements: HomebrewElement[]) {
  return homebrewPackages(elements).find(pack => pack.members.some(member => member.id === element.id));
}

export function homebrewPackageLabel(pack: HomebrewPackage) {
  const parts: string[] = [];
  const count = (type: HomebrewElement['type'], one: string, many: string) => {
    const value = pack.counts[type] || 0;
    if (value) parts.push(`${value} ${value === 1 ? one : many}`);
  };
  count('subclass', 'подкласс', 'подкласса');
  count('ability', 'вариант', 'вариантов');
  count('spell', 'заклинание', 'заклинаний');
  count('table', 'таблица', 'таблиц');
  return parts.join(' · ') || `${pack.members.length} элемент`;
}
