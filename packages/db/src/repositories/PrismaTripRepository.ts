import { PrismaClient } from '@prisma/client';
import { ITripRepository, Trip } from '@repo/application';
import { CreateTripDTO, UpdateTripDTO } from '@repo/core';

export class PrismaTripRepository implements ITripRepository {
  constructor(private readonly db: PrismaClient) {}

  async findManyByTenant(tenantId: string): Promise<Trip[]> {
    return this.db.trip.findMany({
      where: { tenantId, deletedAt: null },
      include: { driver: { include: { user: { select: { name: true } } } }, stops: true },
      orderBy: { date: 'desc' },
    }) as unknown as Trip[];
  }

  async findById(id: string): Promise<Trip | null> {
    return this.db.trip.findFirst({
      where: { id, deletedAt: null },
      include: { driver: { include: { user: { select: { name: true } } } }, stops: true },
    }) as unknown as Trip | null;
  }

  async create(tenantId: string, data: CreateTripDTO): Promise<Trip> {
    const { stops, ...tripData } = data;

    return this.db.trip.create({
      data: {
        tenantId,
        ...tripData,
        date: tripData.date ? new Date(tripData.date) : new Date(),
        driverId: tripData.driverId as string,
        ...(stops && Array.isArray(stops) && stops.length > 0 ? {
          stops: {
            create: stops.map((s: any) => ({
              address: s.address,
              contactPhone: s.contactPhone || null,
              status: s.status || 'pending',
              type: s.type || 'stop',
            })),
          },
        } : {}),
      },
      include: { stops: true, driver: { include: { user: { select: { name: true } } } } },
    }) as unknown as Trip;
  }

  async update(id: string, data: UpdateTripDTO): Promise<Trip> {
    const { id: _id, stops, ...tripData } = data;

    if (stops && Array.isArray(stops)) {
      for (const stop of stops) {
        if (stop.id) {
          await this.db.tripStop.update({
            where: { id: stop.id },
            data: {
              ...(stop.status && { status: stop.status }),
              ...(stop.completedAt && { completedAt: new Date(stop.completedAt) }),
            },
          });
        }
      }
    }

    return this.db.trip.update({
      where: { id },
      data: tripData,
      include: { stops: true, driver: { include: { user: { select: { name: true } } } } },
    }) as unknown as Trip;
  }

  async delete(id: string): Promise<void> {
    await this.db.trip.update({ where: { id }, data: { status: 'cancelled', deletedAt: new Date() } });
  }
}
