export type NavigationPlatform = 'android' | 'ios' | 'web';

export function getDirectionsUrl(platform: NavigationPlatform, latitude: number, longitude: number, label = 'Service location'): string {
  const destination = `${latitude},${longitude}`;
  if (platform === 'ios') return `maps://?daddr=${destination}&dirflg=d`;
  if (platform === 'android') return `geo:${destination}?q=${encodeURIComponent(`${destination} (${label})`)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
