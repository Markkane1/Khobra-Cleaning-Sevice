import { PrismaClient } from '@prisma/client';
import { IComplaintRepository, Complaint } from '@repo/application';
import { CreateComplaintDTO, UpdateComplaintDTO } from '@repo/core';
import { nextReference } from '../reference-sequence';

export class PrismaComplaintRepository implements IComplaintRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Complaint[]> {
    return this.db.complaint.findMany({
      where: { tenantId, deletedAt: null },
      include: { 
        customer: { include: { user: { select: { name: true } } } }, 
        booking: { select: { bookingNo: true } } 
      },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Complaint[];
  }

  async findById(tenantId: string, id: string): Promise<Complaint | null> {
    return this.db.complaint.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { 
        customer: { include: { user: { select: { name: true } } } }, 
        booking: { select: { bookingNo: true } } 
      },
    }) as unknown as Complaint | null;
  }

  async create(tenantId: string, data: CreateComplaintDTO): Promise<Complaint> {
    return this.db.$transaction(async tx => {
      const complaintNo = await nextReference(tx, tenantId, 'complaint', 'CMP', 5, 999);
      return tx.complaint.create({
        data: { tenantId, complaintNo, ...data },
        include: {
          customer: { include: { user: { select: { name: true } } } },
          booking: { select: { bookingNo: true } },
        },
      });
    }) as unknown as Complaint;
  }

  async update(tenantId: string, id: string, data: UpdateComplaintDTO): Promise<Complaint> {
    const { id: _id, ...updateData } = data;
    return this.db.complaint.update({
      where: { id, tenantId },
      data: {
        ...updateData,
        ...(data.status && { resolvedAt: ['resolved', 'closed'].includes(data.status) ? data.resolvedAt || new Date() : null }),
      },
      include: { 
        customer: { include: { user: { select: { name: true } } } }, 
        booking: { select: { bookingNo: true } } 
      },
    }) as unknown as Complaint;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.complaint.update({ where: { id, tenantId }, data: { status: 'closed', deletedAt: new Date() } });
  }
}
