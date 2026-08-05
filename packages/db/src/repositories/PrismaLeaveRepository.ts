import { PrismaClient } from '@prisma/client';
import { ILeaveRepository, LeaveRecord } from '@repo/application';
import { CreateLeaveDTO, UpdateLeaveDTO } from '@repo/core';

export class PrismaLeaveRepository implements ILeaveRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<LeaveRecord[]> {
    return this.db.leaveRecord.findMany({
      where: { tenantId },
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as unknown as LeaveRecord[];
  }

  async findById(tenantId: string, id: string): Promise<LeaveRecord | null> {
    return this.db.leaveRecord.findFirst({
      where: { id, tenantId },
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    }) as unknown as LeaveRecord | null;
  }

  async create(tenantId: string, data: CreateLeaveDTO): Promise<LeaveRecord> {
    return this.db.leaveRecord.create({
      data: {
        tenantId,
        employeeId: data.employeeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        type: data.type || 'Annual',
        days: data.days ? Number(data.days) : 1,
        reason: data.reason || null,
        status: 'pending',
      },
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    }) as unknown as LeaveRecord;
  }

  async update(tenantId: string, id: string, data: UpdateLeaveDTO): Promise<LeaveRecord> {
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.approvedBy) updateData.approvedBy = data.approvedBy;

    return this.db.leaveRecord.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    }) as unknown as LeaveRecord;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.leaveRecord.delete({ where: { id, tenantId } });
  }
}
