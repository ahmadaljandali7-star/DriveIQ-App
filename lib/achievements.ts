import type { Trip } from './storage';
import type { Strings } from './i18n';

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress: number; // 0..1
}

export function computeAchievements(trips: Trip[], t: Strings): Achievement[] {
  const total = trips.length;
  const km = trips.reduce((s, x) => s + x.distance, 0);
  const perfect = trips.some((x) => x.score === 100);
  const eco = trips.some((x) => x.hardBrakes === 0 && x.hardAccel === 0 && x.distance >= 1);
  const night = trips.some((x) => {
    const h = new Date(x.endedAt).getHours();
    return h >= 22 || h < 4;
  });
  return [
    { id: 'safe', icon: '🛡️', title: t.achievements_safe, desc: t.achievements_safe_desc, unlocked: total >= 10, progress: Math.min(1, total / 10) },
    { id: 'energy', icon: '🏁', title: t.achievements_energy, desc: t.achievements_energy_desc, unlocked: total >= 50, progress: Math.min(1, total / 50) },
    { id: 'perfect', icon: '⭐', title: t.achievements_perfect, desc: t.achievements_perfect_desc, unlocked: perfect, progress: perfect ? 1 : 0 },
    { id: 'eco', icon: '🌿', title: t.achievements_eco, desc: t.achievements_eco_desc, unlocked: eco, progress: eco ? 1 : 0 },
    { id: 'warrior', icon: '🛣️', title: t.achievements_warrior, desc: t.achievements_warrior_desc, unlocked: km >= 100, progress: Math.min(1, km / 100) },
    { id: 'night', icon: '🦉', title: t.achievements_night, desc: t.achievements_night_desc, unlocked: night, progress: night ? 1 : 0 },
  ];
}
