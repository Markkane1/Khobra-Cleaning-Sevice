import { CreateComplaintDTO, UpdateComplaintDTO } from '@repo/core';

export interface Complaint {
  id: string;
  tenantId: string;
  complaintNo: string;
  customerId: string | null;
  bookingId: string | null;
  category: string | null;
  priority: string;
  status: string;
  description: string;
  resolution: string | null;
  attachments: string | null;
  assignedTo: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer?: {
    user: {
      name: string;
    };
  } | null;
  booking?: {
    bookingNo: string;
  } | null;
}

export interface IComplaintRepository {
  findManyByTenant(tenantId: string): Promise<Complaint[]>;
  findById(tenantId: string, id: string): Promise<Complaint | null>;
  create(tenantId: string, data: CreateComplaintDTO): Promise<Complaint>;
  update(tenantId: string, id: string, data: UpdateComplaintDTO): Promise<Complaint>;
  delete(tenantId: string, id: string): Promise<void>;
}
