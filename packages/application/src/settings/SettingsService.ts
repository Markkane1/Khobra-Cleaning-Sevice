import { UpdateSettingsDTO } from '@repo/core';
import { ISettingsRepository, SettingsResponse } from './ISettingsRepository';

export class SettingsService {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async getSettings(tenantId: string): Promise<SettingsResponse> {
    return this.settingsRepository.getSettings(tenantId);
  }

  async updateSettings(tenantId: string, data: UpdateSettingsDTO): Promise<{ success: boolean; tenant: any }> {
    return this.settingsRepository.updateSettings(tenantId, data);
  }
}
