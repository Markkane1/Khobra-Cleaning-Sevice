import { PrismaClient } from '@prisma/client';
import { IDriverRepository, Driver } from '@repo/application/src/drivers/IDriverRepository';
import { CreateDriverDTO, UpdateDriverDTO } from '@repo/core/src/drivers/schema';
import { nextReference } from '../reference-sequence';
import { hashPassword } from '../password';

export class PrismaDriverRepository implements IDriverRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Driver[]> {
    return this.db.driver.findMany({
      where: { tenantId },
      include: { user: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Driver[];
  }

  async findById(tenantId: string, id: string): Promise<Driver | null> {
    return this.db.driver.findFirst({
      where: { id, tenantId },
      include: { user: { select: { name: true, email: true, phone: true } } },
    }) as unknown as Driver | null;
  }

  async create(tenantId: string, data: CreateDriverDTO): Promise<Driver> {
    const driverEmail = data.email || `driver_${Date.now()}@khobra.ae`;
    const licenseNo = data.licenseNo || `LIC-${Math.floor(10000 + Math.random() * 90000)}`;
    const vehicleNo = data.vehicleNo || `UAE-${Math.floor(1000 + Math.random() * 9000)}`;
    const status = data.status || 'active';

    return this.db.$transaction(async tx => {
      const driverCode = await nextReference(tx, tenantId, 'driver', 'DRV', 4, 0);
      const user = await tx.user.create({
        data: {
          tenantId,
          name: data.name,
          email: driverEmail,
          phone: data.phone || null,
          passwordHash: hashPassword(data.temporaryPassword),
          role: 'driver',
          status: 'active',
        },
      });

      return tx.driver.create({
        data: {
          tenantId,
          userId: user.id,
          driverCode,
          licenseNo,
          vehicleInfo: vehicleNo,
          status,
        },
        include: { user: { select: { name: true, email: true, phone: true } } },
      });
    }) as unknown as Driver;
  }


  async update(tenantId: string, id: string, data: UpdateDriverDTO): Promise<Driver> {
    const { id: _id, name, email, phone, vehicleNo, ...driverData } = data;
    return this.db.$transaction(async tx => {
      const driver = await tx.driver.findFirst({ where: { id, tenantId } });
      if (!driver) throw new Error('Driver not found');
      if (name !== undefined || email !== undefined || phone !== undefined) await tx.user.update({
        where: { id: driver.userId },
        data: { 
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
        },
      });
      return tx.driver.update({ where: { id, tenantId }, data: { ...driverData, ...(vehicleNo !== undefined && { vehicleInfo: vehicleNo }) }, include: { user: { select: { name: true, email: true, phone: true } } } });
    }) as unknown as Driver;
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const driver = await this.db.driver.findFirst({ where: { id, tenantId }, select: { userId: true, user: { select: { role: true } } } });
    if (!driver) return;
    if (driver.user.role === 'admin') throw Object.assign(new Error('Remove the administrator role before deleting this driver profile'), { status: 409 });

    const now = new Date()

    // ponytail: Soft-delete driver & deactivate user account to preserve dispatch/trip history
    await this.db.$transaction([
      this.db.driver.update({
        where: { id, tenantId },
        data: { status: 'inactive', deletedAt: now },
      }),
      this.db.user.update({
        where: { id: driver.userId },
        data: { status: 'inactive' },
      }),
    ])
  }

}
