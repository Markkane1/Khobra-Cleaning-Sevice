import type { CapacitorConfig } from '@capacitor/cli'

const url = process.env.CAPACITOR_SERVER_URL

const config: CapacitorConfig = {
  appId: 'com.khobracleaning.app',
  appName: 'Khobra Cleaning',
  webDir: 'www',
  includePlugins: ['@capacitor/filesystem', '@capacitor/push-notifications', '@capacitor/share'],
  ...(url ? { server: { url, cleartext: url.startsWith('http://'), errorPath: 'index.html' } } : {}),
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'banner', 'list'] },
  },
}

export default config
