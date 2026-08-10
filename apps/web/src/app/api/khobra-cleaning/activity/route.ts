import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaActivityRepository } from '@repo/db/src/repositories/PrismaActivityRepository';
import { ActivityService } from '@repo/application/src/activity/ActivityService';
import { requireAuth } from '@/lib/auth';
import { apiErrorResponse } from '@/lib/api-error';

// ponytail: single activity service
const activityRepository = new PrismaActivityRepository(db);
const activityService = new ActivityService(activityRepository);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req, ['admin']);
    if ('response' in auth) return auth.response;

    const activities = await activityService.getActivities(auth.session.tenantId);
    return NextResponse.json(activities);
  } catch (error) {
    return apiErrorResponse(error, { fallback: 'Failed to load activity' });
  }
}



