import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreatePreacherDto, UpdateStaffDto } from './dto/staff.dto';

const staffSelect = {
  id: true,
  role: true,
  bio: true,
  photoKey: true,
  status: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  list(churchId: string) {
    return this.prisma.churchStaff.findMany({
      where: { churchId },
      select: staffSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Le Church Admin crée le compte du prédicateur.
   * Règle MVP : un prédicateur n'est rattaché qu'à une seule église (user_id unique dans church_staff).
   */
  async createPreacher(churchId: string, dto: CreatePreacherDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { staff: true },
    });
    if (existing?.staff) {
      throw new ConflictException('Cet utilisateur est déjà rattaché à une église');
    }

    return this.prisma.$transaction(async (tx) => {
      const user =
        existing ??
        (await tx.user.create({
          data: {
            name: dto.name.trim(),
            email,
            passwordHash: await this.auth.hashPassword(dto.temporaryPassword),
          },
        }));
      return tx.churchStaff.create({
        data: { userId: user.id, churchId, role: StaffRole.PREACHER, bio: dto.bio },
        select: staffSelect,
      });
    });
  }

  async update(churchId: string, staffId: string, dto: UpdateStaffDto) {
    // Le filtre churchId empêche de modifier le staff d'une autre église
    const res = await this.prisma.churchStaff.updateMany({
      where: { id: staffId, churchId },
      data: dto,
    });
    if (res.count === 0) throw new NotFoundException('Membre du staff introuvable');
    return this.prisma.churchStaff.findUniqueOrThrow({ where: { id: staffId }, select: staffSelect });
  }
}
