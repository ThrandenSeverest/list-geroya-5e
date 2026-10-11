import { AdventureApp } from '../page';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Таверна и приключения — Лист Героя 5e', description: 'Игровой помощник D&D: персонажи, заклинания, инвентарь и броски кубов.' };
export default function AdventurePage() { return <AdventureApp />; }
