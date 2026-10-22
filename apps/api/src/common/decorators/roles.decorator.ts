import { SetMetadata } from '@nestjs/common';
import { PlatformRole, StaffRole } from '@prisma/client';

export const PLATFORM_ROLES_KEY = 'platformRoles';
/** Rôle plateforme exigé (ex. SUPER_ADMIN pour les écrans d'administration). */
export const PlatformRoles = (...roles: PlatformRole[]) => SetMetadata(PLATFORM_ROLES_KEY, roles);

export const CHURCH_ROLES_KEY = 'churchRoles';
/**
 * Rôle exigé DANS l'église désignée par le paramètre de route `:churchId`.
 * Vérifié par ChurchScopeGuard. Le Super Admin passe toujours.
 */
export const ChurchRoles = (...roles: StaffRole[]) => SetMetadata(CHURCH_ROLES_KEY, roles);
