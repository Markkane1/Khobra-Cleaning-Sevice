import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PrismaDashboardRepository } from '@repo/db/src/repositories/PrismaDashboardRepository';
import { DashboardService } from '@repo/application/src/dashboard/DashboardService';

const dashboardRepository = new PrismaDashboardRepository(db);
const dashboardService = new DashboardService(dashboardRepository);

export async function GET() {
  try {
    const tenant = await db.tenant.findFirst();
    if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 404 });

    const data = await dashboardService.getDashboardData(tenant.id);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}


