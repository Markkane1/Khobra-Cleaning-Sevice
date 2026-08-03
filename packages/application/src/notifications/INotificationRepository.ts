import { CreateNotificationDTO, UpdateNotificationDTO } from '@repo/core';

export interface Notification {
  id: string;
  tenantId: string;
  userId: string | null;
  title: string;
  message: string;
  type: string;
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
