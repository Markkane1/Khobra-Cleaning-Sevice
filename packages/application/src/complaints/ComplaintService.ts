import { CreateComplaintDTO, UpdateComplaintDTO } from '@repo/core';
import { IComplaintRepository, Complaint } from './IComplaintRepository';

export class ComplaintService {
  constructor(private readonly complaintRepository: IComplaintRepository) {}

  async getComplaints(tenantId: string): Promise<Complaint[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.complaintRepository.findManyByTenant(tenantId);
  }

  async createComplaint(tenantId: string, data: CreateComplaintDTO): Promise<Complaint> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.complaintRepository.create(tenantId, data);
  }

  async updateComplaint(tenantId: string, data: UpdateComplaintDTO): Promise<Complaint> {
    const existing = await this.complaintRepository.findById(tenantId, data.id);
    if (!existing) throw new Error('Complaint not found');
    
    // Set resolvedAt if status is resolved
    if (data.status === 'resolved' && !data.resolvedAt) {
      data.resolvedAt = new Date();
    }
    
    return this.complaintRepository.update(tenantId, data.id, data);
  }

  async deleteComplaint(tenantId: string, id: string): Promise<void> {
    const existing = await this.complaintRepository.findById(tenantId, id);
    if (!existing) throw new Error('Complaint not found');
    return this.complaintRepository.delete(tenantId, id);
  }
}
