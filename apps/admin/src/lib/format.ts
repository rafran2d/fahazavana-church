import type { ProcessingStatus, QuotaLine, StaffRole, PlatformRole } from '../api/types';

const GB = 1024 ** 3;

export const LANGUAGES: Record<string, string> = { mg: 'Malagasy', fr: 'Français', en: 'Anglais' };
export const langName = (code: string) => LANGUAGES[code] ?? code.toUpperCase();

/** 9.4 → "9,4" ; 21 → "21" ; arrondi à une décimale, séparateurs français. */
export function num(n: number, digits = 1): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits }).format(n);
}

export const minutesToHours = (min: number) => num(min / 60);
export const bytesToGo = (bytes: number) => num(bytes / GB);

/** Ratio d'utilisation borné à [0, 1]. Un plafond nul est considéré comme atteint. */
export function ratio(used: number, limit: number): number {
  if (limit <= 0) return 1;
  return Math.max(0, Math.min(1, used / limit));
}

/** Seuil d'alerte des quotas (barre rouge, statut « Quota bas »). */
export const ALERT_RATIO = 0.9;
export const isAlert = (q: QuotaLine) => q.used / Math.max(q.limit, 1) >= ALERT_RATIO;

export interface QuotaView {
  key: 'live' | 'ai' | 'storage' | 'members';
  label: string;
  used: string;
  limit: string;
  unit: string;
  ratio: number;
  alert: boolean;
}

/** Ligne de quota de l'API (minutes, octets, membres) → valeurs affichées (h, Go, membres). */
export function quotaView(key: QuotaView['key'], q: QuotaLine): QuotaView {
  const labels = { live: 'Direct', ai: 'IA', storage: 'Stockage', members: 'Membres' } as const;
  const conv =
    key === 'storage'
      ? { used: bytesToGo(q.used), limit: bytesToGo(q.limit), unit: 'Go' }
      : key === 'members'
        ? { used: num(q.used, 0), limit: num(q.limit, 0), unit: '' }
        : { used: minutesToHours(q.used), limit: minutesToHours(q.limit), unit: 'h' };
  return { key, label: labels[key], ...conv, ratio: ratio(q.used, q.limit), alert: isAlert(q) };
}

export const quotaText = (v: QuotaView) => `${v.used} / ${v.limit}${v.unit ? ` ${v.unit}` : ''}`;

/** 4320 s → "1 h 12" ; 3480 s → "58 min". */
export function duration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '—';
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

export function sinceMinutes(iso: string | null, now = Date.now()): string {
  if (!iso) return 'démarrage…';
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  return min < 60 ? `depuis ${min} min` : `depuis ${duration(min * 60)}`;
}

/** "5 oct. 2026" */
export const date = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

/** "05/10 · 10:01" (journal d'activité) */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const monthName = (d = new Date()) => new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d);

/** Prix stocké en centimes d'ariary ; 0 = prix pas encore fixé. */
export function price(cents: number): string {
  if (!cents) return 'à définir';
  return `${num(cents / 100, 0)} Ar`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export const STATUS: Record<ProcessingStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'off' }> = {
  DONE: { label: '✓ Prête', tone: 'ok' },
  PROCESSING: { label: 'En cours', tone: 'warn' },
  PENDING: { label: 'En attente', tone: 'off' },
  FAILED: { label: 'Échec', tone: 'bad' },
};

export function roleLabel(platformRole?: PlatformRole, staffRole?: StaffRole | null): string {
  if (platformRole === 'SUPER_ADMIN') return 'Super Admin';
  if (staffRole === 'ADMIN') return 'Church Admin';
  if (staffRole === 'PREACHER') return 'Prédicateur';
  return 'Membre';
}

const ACTIONS: Record<string, string> = {
  'church.create': "Création de l'église",
  'church.update': "Modification de l'église",
  'church.status': "Changement de statut de l'église",
  'staff.preacher.create': "Création d'un prédicateur",
  'staff.update': "Modification d'un membre du staff",
  'live.start': "Démarrage d'un direct",
  'live.stop': "Arrêt d'un direct",
  'sermon.unpublish': "Dépublication d'une prédication",
  'subscription.assign': "Attribution d'un abonnement",
  'plan.create': "Création d'un plan",
  'plan.update': "Modification d'un plan",
};
export const actionLabel = (action: string) => ACTIONS[action] ?? action;

/** Mot de passe provisoire lisible (sans 0/O ni 1/l), 12 caractères. */
export function temporaryPassword(rand: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[rand(alphabet.length)];
  return out;
}

export const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());
