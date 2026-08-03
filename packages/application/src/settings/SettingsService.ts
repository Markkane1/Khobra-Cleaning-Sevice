import { UpdateSettingsDTO } from '@repo/core';
import { ISettingsRepository, SettingsResponse } from './ISettingsRepository';

export class SettingsService {
  constructor(private readonly settingsRepository: ISettingsRepository) {}

  async getSettings(): Promise<SettingsResponse> {
    return this.settingsRepository.getSettings();
  }

  async updateSettings(data: UpdateSettingsDTO): Promise<{ success: boolean; tenant: any }> {
    return this.settingsRepository.updateSettings(data);
  }
}
