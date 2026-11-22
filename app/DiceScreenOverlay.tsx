'use client';
import { useEffect, useRef } from 'react';
import type { DiceResult } from './adventure';
import { diceFromResult, diceMesh, type ScreenDie, type Vec3 } from './diceScreenMath';
import './dice-screen.css';

export type ScreenRoll = { id: string; name: string; result: DiceResult };
export type DiceScreenOptions = { enabled: boolean; color: string; lifetime: number };

type DrawDie = ScreenDie & { id: string; index: number; started: number; seed: number };
const ARRIVE_MS = 1450;
const FADE_MS = 400;

function rotate([x, y, z]: Vec3, rx: number, ry: number, rz: number): Vec3 {
  const ax = x, ay = y * Math.cos(rx) - z * Math.sin(rx), az = y * Math.sin(rx) + z * Math.cos(rx);
  const bx = ax * Math.cos(ry) + az * Math.sin(ry), by = ay, bz = -ax * Math.sin(ry) + az * Math.cos(ry);
  return [bx * Math.cos(rz) - by * Math.sin(rz), bx * Math.sin(rz) + by * Math.cos(rz), bz];
}
function centerPoint(vertices: Vec3[]): Vec3 {
  const sum = vertices.reduce<Vec3>((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
  return [sum[0] / vertices.length, sum[1] / vertices.length, sum[2] / vertices.length];
}
function hash(value: string): number {
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967295;
}
function rgb(hex: string) {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#332c27';
  return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16));
}
function shade(color: number[], light: number) {
  return 'rgb(' + color.map(channel => Math.round(Math.min(255, channel * light))).join(',') + ')';
}
function settle(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - p, 4);
}
function drawDie(ctx: CanvasRenderingContext2D, die: DrawDie, width: number, height: number, now: number, color: number[], total: number) {
  const elapsed = now - die.started;
  const progress = Math.min(1, Math.max(0, elapsed / ARRIVE_MS));
  const mobile = width < 650;
  const size = Math.max(mobile ? 22 : 32, Math.min(mobile ? 48 : 67, Math.min(width / Math.sqrt(Math.max(total, 1)) * .67, height / Math.sqrt(Math.max(total, 1)) * .64)));
  const cols = Math.max(1, Math.ceil(Math.sqrt(total * width / height)));
  const rows = Math.ceil(total / cols);
  const col = die.index % cols;
  const row = Math.floor(die.index / cols);
  const zoneX = (col + .5) / cols;
  const zoneY = (row + .5) / rows;
  const x = width * (.10 + zoneX * .80) + (die.seed - .5) * Math.min(35, width / cols * .18);
  const targetY = height * (.17 + zoneY * .65);
  const fallingY = targetY - Math.pow(1 - progress, 2) * Math.min(height * .65, 620);
  const impact = progress > .66 ? Math.max(0, Math.sin((progress - .66) * Math.PI * 9)) * Math.pow(1 - progress, 2) * 48 : 0;
  const y = fallingY - impact;
  const rotation = settle(progress);
  const spin = (1 - rotation) * (Math.PI * 5.4 + die.seed * 6);
  const rx = .34 + die.seed * 2.5 + spin;
  const ry = .25 + die.seed * 3.8 + spin * .85;
  const rz = -.17 + die.seed * .28 + spin * .4;
  const fade = elapsed > ARRIVE_MS + dieLifetimeMs ? Math.max(0, 1 - (elapsed - ARRIVE_MS - dieLifetimeMs) / FADE_MS) : 1;
  if (fade <= 0) return;
  const mesh = diceMesh(die.sides);
  if (!mesh) {
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.rotate((1 - rotation) * Math.PI * 4);
    ctx.shadowColor = '#000a'; ctx.shadowBlur = 15;
    ctx.fillStyle = shade(color, .95); ctx.strokeStyle = '#dfc388'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const angle = k * Math.PI / 4; const px = Math.cos(angle) * size * .75, py = Math.sin(angle) * size * .75; if (!k) ctx.moveTo(px,py); else ctx.lineTo(px,py); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ead7a5'; ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.max(12, size * .4) + 'px Georgia,serif'; ctx.fillText(String(die.value),0,-3);
    ctx.font = 'bold ' + Math.max(9, size * .19) + 'px Georgia,serif'; ctx.fillText('d' + die.sides,0,size * .37);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.shadowColor = '#000a';
  ctx.shadowBlur = mobile ? 10 : 22;
  ctx.shadowOffsetY = mobile ? 5 : 12;
  const transformed = mesh.vertices.map(v => rotate(v, rx, ry, rz));
  const maxDim = Math.max(...mesh.vertices.map(v => Math.hypot(...v))) || 1;
  const scale = size / maxDim;
  const faces = mesh.faces.map((face, i) => {
    const points = face.vertices.map(n => transformed[n]);
    const normal = rotate(face.normal, rx, ry, rz);
    return { points, normal, depth: centerPoint(points)[2], index: i };
  }).filter(face => face.normal[2] > .015).sort((a, b) => a.depth - b.depth);
  const top = faces.reduce<typeof faces[number] | undefined>((best, f) => (!best || f.normal[2] > best.normal[2]) ? f : best, undefined);
  for (const face of faces) {
    const light = .72 + .25 * Math.max(0, face.normal[2]) + .12 * Math.max(0, face.normal[0] * -.5 + face.normal[1] * -.7);
    ctx.beginPath();
    face.points.forEach((v, index) => index ? ctx.lineTo(x + v[0] * scale, y + v[1] * scale) : ctx.moveTo(x + v[0] * scale, y + v[1] * scale));
    ctx.closePath();
    ctx.fillStyle = shade(color, light);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = Math.max(.8, size / 70);
    ctx.strokeStyle = 'rgba(221,192,121,.86)';
    ctx.stroke();
    ctx.save();
    const center = centerPoint(face.points);
    const value = face === top && progress > .80 ? die.value : (face.index * 7 + Math.floor(die.seed * 31)) % (die.sides === 100 ? 10 : die.sides) + 1;
    const printable = die.sides === 100 && face !== top ? String((value % 10) * 10).padStart(2, '0') : String(value);
    const visible = face.normal[2];
    const fontSize = Math.max(8, size * (printable.length > 2 ? .27 : .35) * Math.min(1, visible * 1.8));
    ctx.font = 'bold ' + fontSize + 'px Georgia,serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ead7a5';
    ctx.shadowColor = '#050404';
    ctx.shadowBlur = 3;
    if (visible > .18) ctx.fillText(printable, x + center[0] * scale, y + center[1] * scale, size * .85);
    ctx.restore();
  }
  ctx.restore();
}
let dieLifetimeMs = 3000;

/** One transparent viewport-wide canvas, with no input interception or layout changes. */
export function DiceScreenOverlay({ rolls, options, onExpire }: {
  rolls: ScreenRoll[];
  options: DiceScreenOptions;
  onExpire: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(new Map<string, number>());
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const lifetime = Math.max(0, Math.min(30, options.lifetime)) * 1000;
  useEffect(() => {
    const now = performance.now();
    for (const roll of rolls) if (!timeRef.current.has(roll.id)) timeRef.current.set(roll.id, now);
    const present = new Set(rolls.map(r => r.id));
    for (const id of timeRef.current.keys()) if (!present.has(id)) timeRef.current.delete(id);
  }, [rolls]);
  useEffect(() => {
    if (!options.enabled || !rolls.length) return;
    const timeouts = rolls.map(roll => {
      const started = timeRef.current.get(roll.id) ?? performance.now();
      return window.setTimeout(() => expireRef.current(roll.id), Math.max(0, started + ARRIVE_MS + lifetime + FADE_MS - performance.now()));
    });
    return () => timeouts.forEach(window.clearTimeout);
  }, [rolls, options.enabled, lifetime]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!options.enabled || !canvas || !rolls.length) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    let frame = 0, stopped = false;
    dieLifetimeMs = lifetime;
    const items = rolls.flatMap(roll => diceFromResult(roll.result).map((die, i) => ({
      ...die, id: roll.id + ':' + i,
      started: timeRef.current.get(roll.id) ?? performance.now(),
      seed: hash(roll.id + ':' + i),
      index: 0
    })));
    items.forEach((item, index) => { item.index = index; });
    function paint(now: number) {
      if (stopped || !canvas || !ctx) return;
      const width = window.innerWidth, height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const color = rgb(options.color);
      for (const die of items) drawDie(ctx, die, width, height, now, color, items.length);
      frame = requestAnimationFrame(paint);
    }
    frame = requestAnimationFrame(paint);
    return () => { stopped = true; cancelAnimationFrame(frame); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [rolls, options.enabled, options.color, lifetime]);
  if (!options.enabled || !rolls.length) return null;
  return <canvas ref={canvasRef} className="hero-screen-dice" aria-hidden="true" />;
}
