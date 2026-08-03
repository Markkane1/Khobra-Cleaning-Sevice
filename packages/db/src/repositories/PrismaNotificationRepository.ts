import { PrismaClient } from '@prisma/client';
import { INotificationRepository, Notification } from '@repo/application';
import { CreateNotificationDTO } from '@repo/core';

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Notification[]> {
    return this.db.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }) as unknown as Notification[];
  }

  async create(tenantId: string, data: CreateNotificationDTO): Promise<Notification> {
    return this.db.notification.create({
      data: {
        tenantId,
        userId: data.userId || null,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        read: false,
      },
    }) as unknown as Notification;
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.db.notification.update({
      where: { id },
      data: { read: true },
    }) as unknown as Notification;
  }

  async markAllAsRead(tenantId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { tenantId, read: false },
      data: { read: true },
    });
  }
}
