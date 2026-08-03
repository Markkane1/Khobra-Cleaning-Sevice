import { CreateNotificationDTO, UpdateNotificationDTO } from '@repo/core';
import { INotificationRepository, Notification } from './INotificationRepository';

export class NotificationService {
  constructor(private readonly notificationRepository: INotificationRepository) {}

  async getNotifications(tenantId: string): Promise<Notification[]> {
    if (!tenantId) throw new Error('Tenant ID is required');
    return this.notificationRepository.findManyByTenant(tenantId);
  }

  async createNotification(tenantId: string, data: CreateNotificationDTO): Promise<Notification> {
    if (!tenantId) throw new Error('Tenant ID is required');
    if (!data.title || !data.message) {
      throw new Error('Title and message required');
    }
    return this.notificationRepository.create(tenantId, data);
  }

  async updateNotification(tenantId: string, data: UpdateNotificationDTO): Promise<Notification | { success: boolean }> {
    if (data.markAllRead) {
      if (!tenantId) throw new Error('Tenant ID is required to mark all as read');
      await this.notificationRepository.markAllAsRead(tenantId);
      return { success: true };
    }

    if (data.id) {
      return this.notificationRepository.markAsRead(data.id);
    }

    throw new Error('Notification ID or markAllRead required');
  }
}
