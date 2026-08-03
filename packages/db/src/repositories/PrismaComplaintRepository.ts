import { PrismaClient } from '@prisma/client';
import { IComplaintRepository, Complaint } from '@repo/application';
import { CreateComplaintDTO, UpdateComplaintDTO } from '@repo/core';

export class PrismaComplaintRepository implements IComplaintRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Complaint[]> {
    return this.db.complaint.findMany({
      where: { tenantId },
      include: { 
        customer: { include: { user: { select: { name: true } } } }, 
        booking: { select: { bookingNo: true } } 
      },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Complaint[];
  }

  async findById(id: string): Promise<Complaint | null> {
    return this.db.complaint.findUnique({
      where: { id },
      include: { 
        customer: { include: { user: { select: { name: true } } } }, 
        booking: { select: { bookingNo: true } } 
      },
    }) as unknown as Complaint | null;
  }

  async create(tenantId: string, data: CreateComplaintDTO): Promise<Complaint> {
    const count = await this.db.complaint.count({ where: { tenantId } });
    const complaintNo = `CMP-${String(1000 + count).padStart(5, '0')}`;
    
    return this.db.complaint.create({
      data: {
        tenantId,
        complaintNo,
        ...data,
      },
      include: { 
        customer: { include: { user: { select: { name: true } } } }, 
        booking: { select: { bookingNo: true } } 
      },
    }) as unknown as Complaint;
  }

  async update(id: string, data: UpdateComplaintDTO): Promise<Complaint> {
    const { id: _id, ...updateData } = data;
    return this.db.complaint.update({
      where: { id },
      data: updateData,
      include: { 
        customer: { include: { user: { select: { name: true } } } }, 
        booking: { select: { bookingNo: true } } 
      },
    }) as unknown as Complaint;
  }

  async delete(id: string): Promise<void> {
    await this.db.complaint.delete({ where: { id } });
  }
}
