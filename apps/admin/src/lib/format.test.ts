import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  dateTime,
  duration,
  initials,
  isEmail,
  num,
  price,
  quotaText,
  quotaView,
  ratio,
  roleLabel,
  temporaryPassword,
} from './format';

describe('format', () => {
  it('formate les nombres à la française', () => {
    expect(num(9.4)).toBe('9,4');
    expect(num(21)).toBe('21');
    expect(num(2000, 0).replace(/\s/g, ' ')).toBe('2 000');
  });

  it('convertit les quotas de l’API en heures, Go et membres', () => {
    const live = quotaView('live', { used: 1260, limit: 3000, unit: 'min' });
    expect(quotaText(live)).toBe('21 / 50 h');
    expect(live.alert).toBe(false);

    const storage = quotaView('storage', { used: 18.4 * 1024 ** 3, limit: 50 * 1024 ** 3, unit: 'bytes' });
    expect(quotaText(storage)).toBe('18,4 / 50 Go');

    const ai = quotaView('ai', { used: 2880, limit: 3000, unit: 'min' });
    expect(ai.alert).toBe(true);
    expect(quotaText(quotaView('members', { used: 312, limit: 500, unit: 'membres' }))).toBe('312 / 500');
  });

  it('borne le ratio et traite un plafond nul comme atteint', () => {
    expect(ratio(120, 100)).toBe(1);
    expect(ratio(-5, 100)).toBe(0);
    expect(ratio(0, 0)).toBe(1);
  });

  it('affiche les durées comme dans les maquettes', () => {
    expect(duration(4320)).toBe('1 h 12');
    expect(duration(3480)).toBe('58 min');
    expect(duration(3600)).toBe('1 h 00');
    expect(duration(null)).toBe('—');
  });

  it('formate le journal et les prix', () => {
    expect(dateTime(new Date(2026, 9, 5, 10, 1).toISOString())).toBe('05/10 · 10:01');
    expect(price(0)).toBe('à définir');
    expect(price(2_500_000).replace(/\s/g, ' ')).toBe('25 000 Ar');
  });

  it('libellés de rôle et d’action', () => {
    expect(roleLabel('SUPER_ADMIN', null)).toBe('Super Admin');
    expect(roleLabel('USER', 'ADMIN')).toBe('Church Admin');
    expect(roleLabel('USER', 'PREACHER')).toBe('Prédicateur');
    expect(roleLabel('USER', null)).toBe('Membre');
    expect(actionLabel('live.start')).toBe("Démarrage d'un direct");
    expect(actionLabel('inconnue')).toBe('inconnue');
  });

  it('initiales, email et mot de passe provisoire', () => {
    expect(initials('Pasteur Rakotomalala Hery')).toBe('RH');
    expect(isEmail('tojo@fitiavana.mg')).toBe(true);
    expect(isEmail('tojo@')).toBe(false);
    const pwd = temporaryPassword();
    expect(pwd).toHaveLength(12);
    expect(pwd).not.toMatch(/[0O1l]/);
  });
});
