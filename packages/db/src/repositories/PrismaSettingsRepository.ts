import { PrismaClient } from '@prisma/client';
import { ISettingsRepository, SettingsResponse } from '@repo/application';
import { parseTimeToMinutes, UpdateSettingsDTO } from '@repo/core';

export class PrismaSettingsRepository implements ISettingsRepository {
  constructor(private readonly db: PrismaClient) {}

  async getSettings(tenantId: string): Promise<SettingsResponse> {
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return { settings: {}, tenant: null };

    const settingsList = await this.db.appSettings.findMany({ where: { key: { startsWith: `${tenantId}:` } } });
    const settingsMap: Record<string, string> = {};
    settingsList.forEach((s: any) => { settingsMap[s.key.slice(tenantId.length + 1)] = s.value });

    return {
      tenant,
      settings: settingsMap,
    };
  }

  async updateSettings(tenantId: string, data: UpdateSettingsDTO): Promise<{ success: boolean; tenant: any }> {
    const tenant = await this.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Tenant not found');

    const { name, slug, currency, locale, timezone, taxRate, firstBookingTime, lastWorkingTime, logoUrl, settings } = data;
    const nextFirstBookingTime = firstBookingTime ?? tenant.firstBookingTime;
    const nextLastWorkingTime = lastWorkingTime ?? tenant.lastWorkingTime;
    if (parseTimeToMinutes(nextLastWorkingTime) <= parseTimeToMinutes(nextFirstBookingTime)) {
      throw new Error('Last working time must be later than First booking start time');
    }

    const updatedTenant = await this.db.$transaction(async tx => {
      const updated = await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          ...(name && { name }), ...(slug && { slug }), ...(currency && { currency }), ...(locale && { locale }),
          ...(timezone && { timezone }), ...(taxRate !== undefined && { taxRate }), ...(firstBookingTime && { firstBookingTime }),
          ...(lastWorkingTime && { lastWorkingTime }), ...(logoUrl !== undefined && { logoUrl }),
        },
      });
      for (const [key, value] of Object.entries(settings || {})) await tx.appSettings.upsert({
        where: { key: `${tenantId}:${key}` }, update: { value: String(value) }, create: { key: `${tenantId}:${key}`, value: String(value) },
      });
      return updated;
    });
    return { success: true, tenant: updatedTenant };
  }
}
