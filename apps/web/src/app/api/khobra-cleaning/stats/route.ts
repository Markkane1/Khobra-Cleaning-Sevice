import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaStatsRepository } from '@repo/db/src/repositories/PrismaStatsRepository';
import { StatsService } from '@repo/application/src/stats/StatsService';

const statsRepository = new PrismaStatsRepository(db);
const statsService = new StatsService(statsRepository);

export async function GET() {
  try {
    const tenant = await db.tenant.findFirst();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

    const stats = await statsService.getStats(tenant.id);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}


