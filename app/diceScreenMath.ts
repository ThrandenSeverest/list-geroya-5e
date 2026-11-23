import type { DiceResult } from './adventure';

export type ScreenDie = { sides: number; value: number };
export type Vec3 = [number, number, number];
export type DiceMesh = { vertices: Vec3[]; faces: { vertices: number[]; normal: Vec3 }[] };

const SUPPORTED = new Set([4, 6, 8, 10, 12, 20]);

// The order is the original rolls[] order, not the sum or guessed sides.
export function diceFromResult(result: Pick<DiceResult, 'formula' | 'rolls'>): ScreenDie[] {
  const formula = result.formula.replace(/\s/g, '').toLowerCase();
  const critical = /\(\s*крит\s*:\s*кости\s*[×x*]\s*2\s*\)/i.test(formula);
  const found: number[] = [];
  for (const match of formula.matchAll(/(\d*)[dк](\d+)/g)) {
    const count = Number(match[1] || '1') * (critical ? 2 : 1);
    const sides = Number(match[2]);
    if (count > 0 && count <= 200 && sides >= 2 && sides <= 1000) {
      for (let i = 0; i < count && found.length < result.rolls.length; i++) found.push(sides);
    }
  }
  // Invalid/unrecognized formulas should not invent a shower of d20s.
  return result.rolls.flatMap((value, i) =>
    found[i] >= 2 && found[i] <= 1000 && Number.isInteger(value)
      ? [{ sides: found[i], value }]
      : []
  );
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const average = (vertices: Vec3[]): Vec3 => {
  const total = vertices.reduce((sum, p) => add(sum, p), [0, 0, 0] as Vec3);
  return total.map(v => v / vertices.length) as Vec3;
};

// Convex hull with coplanar triangles joined into correct polygonal faces.
function hull(vertices: Vec3[]): DiceMesh {
  const faces = new Map<string, { vertices: number[]; normal: Vec3 }>();
  for (let i = 0; i < vertices.length; i++) for (let j = i + 1; j < vertices.length; j++) for (let k = j + 1; k < vertices.length; k++) {
    const raw = cross(sub(vertices[j], vertices[i]), sub(vertices[k], vertices[i]));
    if (Math.hypot(...raw) < 0.00001) continue;
    let normal = unit(raw);
    if (dot(normal, vertices[i]) < 0) normal = [-normal[0], -normal[1], -normal[2]];
    const distances = vertices.map(v => dot(normal, sub(v, vertices[i])));
    if (distances.some(d => d > 0.0001)) continue;
    const plane = distances.flatMap((d, n) => Math.abs(d) < 0.0001 ? [n] : []);
    const key = plane.join(',');
    if (faces.has(key)) continue;
    const center = average(plane.map(n => vertices[n]));
    const u = unit(sub(vertices[plane[0]], center));
    const v = cross(normal, u);
    const ordered = plane.sort((a, b) =>
      Math.atan2(dot(sub(vertices[a], center), v), dot(sub(vertices[a], center), u))
      - Math.atan2(dot(sub(vertices[b], center), v), dot(sub(vertices[b], center), u))
    );
    faces.set(key, { vertices: ordered, normal });
  }
  return { vertices, faces: [...faces.values()] };
}

function icosahedron(): Vec3[] {
  const t = (1 + Math.sqrt(5)) / 2;
  return [
    [0, 1, t], [0, -1, t], [0, 1, -t], [0, -1, -t],
    [1, t, 0], [-1, t, 0], [1, -t, 0], [-1, -t, 0],
    [t, 0, 1], [t, 0, -1], [-t, 0, 1], [-t, 0, -1]
  ];
}

/** Ten kite faces, with coplanar vertices. */
function trapezohedron(): DiceMesh {
  const n=5, h=1.38;
  const a=h*(1-Math.cos(Math.PI/n))/(1+Math.cos(Math.PI/n));
  const vertices:Vec3[]=[[0,0,h],[0,0,-h]];
  for(let i=0;i<n;i++){const t=i*2*Math.PI/n;vertices.push([Math.cos(t),Math.sin(t),a]);}
  for(let i=0;i<n;i++){const t=(i+.5)*2*Math.PI/n;vertices.push([Math.cos(t),Math.sin(t),-a]);}
  const faces:DiceMesh['faces']=[];
  for(let i=0;i<n;i++)for(const ids of [
    [0,2+i,7+i,2+(i+1)%n],
    [1,7+i,2+(i+1)%n,7+(i+1)%n]
  ]){
    const center=average(ids.map(j=>vertices[j]));
    let normal=unit(cross(sub(vertices[ids[1]],vertices[ids[0]]),sub(vertices[ids[2]],vertices[ids[0]])));
    if(dot(normal,center)<0){normal=[-normal[0],-normal[1],-normal[2]];ids.reverse();}
    faces.push({vertices:ids,normal});
  }
  return {vertices,faces};
}

const ico = hull(icosahedron());
const meshes: Record<number, DiceMesh> = {
  4: hull([[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]]),
  6: hull([-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z] as Vec3)))),
  8: hull([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]),
  10: trapezohedron(),
  12: hull(ico.faces.map(f => unit(average(f.vertices.map(i => ico.vertices[i]))))),
  20: ico
};

export function diceMesh(sides: number): DiceMesh {
  return meshes[sides];
}

export function supportedScreenDie(sides: number): boolean {
  return SUPPORTED.has(sides);
}
