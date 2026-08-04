import { Prisma, PrismaClient } from '@prisma/client';

;(Prisma.Decimal.prototype as any).toJSON = function (this: Prisma.Decimal) { return this.toNumber(); };

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const db = globalForPrisma.prisma ?? new PrismaClient({ log: ['query'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
