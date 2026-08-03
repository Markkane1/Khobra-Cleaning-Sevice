import { UpdateSettingsDTO } from '@repo/core';

export interface SettingsResponse {
  tenant: any | null;
  settings: Record<string, string>;
}

export interface ISettingsRepository {
  getSettings(): Promise<SettingsResponse>;
  updateSettings(data: UpdateSettingsDTO): Promise<{ success: boolean; tenant: any }>;
}
