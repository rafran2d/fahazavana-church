import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole, StaffRole } from '@prisma/client';
import { ChurchScopeGuard } from './church-scope.guard';

const CHURCH_A = '11111111-1111-1111-1111-111111111111';
const CHURCH_B = '22222222-2222-2222-2222-222222222222';

function contextFor(user: object, churchId: string): ExecutionContext {
  const request: Record<string, unknown> = { user, params: { churchId } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('ChurchScopeGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const prisma = { churchStaff: { findUnique: jest.fn() } };
  const guard = new ChurchScopeGuard(reflector, prisma as never);
  const preacher = { id: 'u1', email: 'p@test', platformRole: PlatformRole.USER };

  beforeEach(() => {
    jest.resetAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([StaffRole.PREACHER]);
  });

  it('autorise un prédicateur sur SON église', async () => {
    prisma.churchStaff.findUnique.mockResolvedValue({
      id: 's1', churchId: CHURCH_A, role: StaffRole.PREACHER, status: 'ACTIVE',
    });
    await expect(guard.canActivate(contextFor(preacher, CHURCH_A))).resolves.toBe(true);
  });

  it("refuse un prédicateur sur une AUTRE église (critère d'acceptation n°1)", async () => {
    prisma.churchStaff.findUnique.mockResolvedValue({
      id: 's1', churchId: CHURCH_A, role: StaffRole.PREACHER, status: 'ACTIVE',
    });
    await expect(guard.canActivate(contextFor(preacher, CHURCH_B))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuse un prédicateur suspendu', async () => {
    prisma.churchStaff.findUnique.mockResolvedValue({
      id: 's1', churchId: CHURCH_A, role: StaffRole.PREACHER, status: 'SUSPENDED',
    });
    await expect(guard.canActivate(contextFor(preacher, CHURCH_A))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuse un membre simple sur une route réservée au staff', async () => {
    prisma.churchStaff.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(contextFor(preacher, CHURCH_A))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('laisse passer le Super Admin', async () => {
    const admin = { id: 'u0', email: 'sa@test', platformRole: PlatformRole.SUPER_ADMIN };
    await expect(guard.canActivate(contextFor(admin, CHURCH_B))).resolves.toBe(true);
  });

  it("ne fait rien sur une route sans @ChurchRoles", async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(contextFor(preacher, CHURCH_B))).resolves.toBe(true);
  });
});
