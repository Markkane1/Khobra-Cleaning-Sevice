import { UpdateSettingsDTO } from '@repo/core';

export interface SettingsResponse {
  tenant: any | null;
  settings: Record<string, string>;
}

export interface ISettingsRepository {
  getSettings(tenantId: string): Promise<SettingsResponse>;
  updateSettings(tenantId: string, data: UpdateSettingsDTO): Promise<{ success: boolean; tenant: any }>;
}
