import { PrismaClient } from '@prisma/client';
import { IAttendanceRepository, Attendance } from '@repo/application';
import { CreateAttendanceDTO, UpdateAttendanceDTO } from '@repo/core';

export class PrismaAttendanceRepository implements IAttendanceRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Attendance[]> {
    return this.db.attendance.findMany({
      where: { tenantId },
      include: { employee: { include: { user: { select: { name: true } } } } },
      orderBy: { date: 'desc' },
      take: 50,
    }) as unknown as Attendance[];
  }

  async findById(tenantId: string, id: string): Promise<Attendance | null> {
    return this.db.attendance.findFirst({
      where: { id, tenantId },
      include: { employee: { include: { user: { select: { name: true } } } } },
    }) as unknown as Attendance | null;
  }

  async create(tenantId: string, data: CreateAttendanceDTO): Promise<Attendance> {
    return this.db.attendance.create({
      data: {
        tenantId,
        ...data,
      },
      include: { employee: { include: { user: { select: { name: true } } } } },
    }) as unknown as Attendance;
  }

  async update(tenantId: string, id: string, data: UpdateAttendanceDTO): Promise<Attendance> {
    const { id: _id, ...updateData } = data;
    return this.db.attendance.update({
      where: { id, tenantId },
      data: updateData,
      include: { employee: { include: { user: { select: { name: true } } } } },
    }) as unknown as Attendance;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.attendance.delete({ where: { id, tenantId } });
  }
}
