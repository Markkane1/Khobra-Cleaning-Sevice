import type { CapacitorConfig } from '@capacitor/cli'

const url = process.env.CAPACITOR_SERVER_URL

const config: CapacitorConfig = {
  appId: 'com.khobracleaning.app',
  appName: 'Khobra Cleaning',
  webDir: 'www',
  ...(url ? { server: { url, cleartext: url.startsWith('http://') } } : {}),
}

export default config
