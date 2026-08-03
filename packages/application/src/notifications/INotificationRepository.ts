import { CreateNotificationDTO, UpdateNotificationDTO } from '@repo/core';

export interface Notification {
  id: string;
  tenantId: string;
  userId: string | null;
  statusHistoryId?: string | null;
  title: string;
  message: string;
  type: string;
  channel?: string;
  deliveryStatus?: string;
  deliveryAttemptedAt?: Date | null;
  deliveryError?: string | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationRepository {
  findManyByTenant(tenantId: string): Promise<Notification[]>;
  create(tenantId: string, data: CreateNotificationDTO): Promise<Notification>;
  markAsRead(id: string): Promise<Notification>;
  markAllAsRead(tenantId: string): Promise<void>;
}
