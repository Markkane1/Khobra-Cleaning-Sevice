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

  async findById(id: string): Promise<Attendance | null> {
    return this.db.attendance.findUnique({
      where: { id },
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

  async update(id: string, data: UpdateAttendanceDTO): Promise<Attendance> {
    const { id: _id, ...updateData } = data;
    return this.db.attendance.update({
      where: { id },
      data: updateData,
      include: { employee: { include: { user: { select: { name: true } } } } },
    }) as unknown as Attendance;
  }

  async delete(id: string): Promise<void> {
    await this.db.attendance.delete({ where: { id } });
  }
}
