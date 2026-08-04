import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaActivityRepository } from '@repo/db/src/repositories/PrismaActivityRepository';
import { ActivityService } from '@repo/application/src/activity/ActivityService';
import { requireAuth } from '@/lib/auth';

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
    console.error('Activity error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}



