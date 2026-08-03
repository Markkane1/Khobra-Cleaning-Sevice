import type { DashboardGateway } from './ports'
import type { DashboardStats } from '../domain/dashboard/types'

export function loadDashboard(gateway: DashboardGateway, token: string): Promise<DashboardStats> {
  return gateway.getStats(token)
}
