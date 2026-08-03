import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaActivityRepository } from '@repo/db/src/repositories/PrismaActivityRepository';
import { ActivityService } from '@repo/application/src/activity/ActivityService';

const activityRepository = new PrismaActivityRepository(db);
const activityService = new ActivityService(activityRepository);

export async function GET() {
  try {
    const tenant = await db.tenant.findFirst();
    if (!tenant) return NextResponse.json([]);

    const activities = await activityService.getActivities(tenant.id);

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Activity error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}


