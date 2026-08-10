import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaStatsRepository } from '@repo/db/src/repositories/PrismaStatsRepository';
import { StatsService } from '@repo/application/src/stats/StatsService';
import { requireAuth } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-error';

// ponytail: single stats service
const statsRepository = new PrismaStatsRepository(db);
const statsService = new StatsService(statsRepository);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if ('response' in auth) return auth.response;
    const stats = await statsService.getStats(auth.session.tenantId);

    return NextResponse.json(stats);
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to load stats' });
  }
}
