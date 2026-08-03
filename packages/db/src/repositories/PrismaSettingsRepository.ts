import { PrismaClient } from '@prisma/client';
import { ISettingsRepository, SettingsResponse } from '@repo/application';
import { parseTimeToMinutes, UpdateSettingsDTO } from '@repo/core';

export class PrismaSettingsRepository implements ISettingsRepository {
  constructor(private readonly db: PrismaClient) {}

  async getSettings(): Promise<SettingsResponse> {
    const tenant = await this.db.tenant.findFirst();
    if (!tenant) return { settings: {}, tenant: null };

    const settingsList = await this.db.appSettings.findMany();
    const settingsMap: Record<string, string> = {};
    settingsList.forEach((s: any) => { settingsMap[s.key] = s.value });

    return {
      tenant,
      settings: settingsMap,
    };
  }

  async updateSettings(data: UpdateSettingsDTO): Promise<{ success: boolean; tenant: any }> {
    const tenant = await this.db.tenant.findFirst();
    if (!tenant) throw new Error('Tenant not found');

    const { name, slug, currency, locale, timezone, taxRate, firstBookingTime, lastWorkingTime, logoUrl, settings } = data;
    const nextFirstBookingTime = firstBookingTime ?? tenant.firstBookingTime;
    const nextLastWorkingTime = lastWorkingTime ?? tenant.lastWorkingTime;
    if (parseTimeToMinutes(nextLastWorkingTime) <= parseTimeToMinutes(nextFirstBookingTime)) {
      throw new Error('Last working time must be later than First booking start time');
    }

    const updatedTenant = await this.db.tenant.update({
      where: { id: tenant.id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(currency && { currency }),
        ...(locale && { locale }),
        ...(timezone && { timezone }),
        ...(taxRate !== undefined && { taxRate }),
        ...(firstBookingTime && { firstBookingTime }),
        ...(lastWorkingTime && { lastWorkingTime }),
        ...(logoUrl !== undefined && { logoUrl }),
      },
    });

    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        await this.db.appSettings.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }
    }

    return { success: true, tenant: updatedTenant };
  }
}
