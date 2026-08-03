import { PrismaClient } from '@prisma/client';
import { IDriverRepository, Driver } from '@repo/application/src/drivers/IDriverRepository';
import { CreateDriverDTO, UpdateDriverDTO } from '@repo/core/src/drivers/schema';

export class PrismaDriverRepository implements IDriverRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Driver[]> {
    return this.db.driver.findMany({
      where: { tenantId },
      include: { user: { select: { name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }) as unknown as Driver[];
  }

  async findById(id: string): Promise<Driver | null> {
    return this.db.driver.findUnique({
      where: { id },
      include: { user: { select: { name: true, email: true, phone: true } } },
    }) as unknown as Driver | null;
  }

  async create(tenantId: string, data: CreateDriverDTO): Promise<Driver> {
    const driverEmail = data.email || `driver_${Date.now()}@khobra.ae`;
    
    const user = await this.db.user.create({
      data: {
        tenantId,
        name: data.name,
        email: driverEmail,
        phone: data.phone || null,
        role: 'DRIVER',
      },
    });

    const licenseNo = data.licenseNo || `LIC-${Math.floor(10000 + Math.random() * 90000)}`;
    const vehicleNo = data.vehicleNo || `UAE-${Math.floor(1000 + Math.random() * 9000)}`;
    const status = data.status || 'AVAILABLE';

    return this.db.driver.create({
      data: {
        tenantId,
        userId: user.id,
        driverCode: `DRV-${Math.floor(1000 + Math.random() * 9000)}`,
        licenseNo,
        vehicleInfo: vehicleNo,
        status,
      },
      include: { user: { select: { name: true, email: true, phone: true } } }
    }) as unknown as Driver;
  }

  async update(id: string, data: UpdateDriverDTO): Promise<Driver> {
    const driver = await this.db.driver.findUnique({ where: { id } });
    
    if (driver && (data.name !== undefined || data.phone !== undefined)) {
      await this.db.user.update({
        where: { id: driver.userId },
        data: { 
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone }),
        },
      });
    }

    const { id: _id, name, email, phone, vehicleNo, ...driverData } = data;

    return this.db.driver.update({
      where: { id },
      data: { ...driverData, ...(vehicleNo !== undefined && { vehicleInfo: vehicleNo }) },
      include: { user: { select: { name: true, email: true, phone: true } } }
    }) as unknown as Driver;
  }

  async delete(id: string): Promise<void> {
    const driver = await this.db.driver.findUnique({ where: { id }, select: { userId: true } });
    if (!driver) return;

    // Delete child records first (no onDelete: Cascade in schema)
    const trips = await this.db.trip.findMany({ where: { driverId: id }, select: { id: true } });
    const tripIds = trips.map(t => t.id);
    if (tripIds.length > 0) {
      await this.db.tripStop.deleteMany({ where: { tripId: { in: tripIds } } });
      await this.db.trip.deleteMany({ where: { driverId: id } });
    }
    await this.db.driver.delete({ where: { id } });
    await this.db.user.delete({ where: { id: driver.userId } });
  }
}
