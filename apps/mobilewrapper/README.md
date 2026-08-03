# Khobra Mobile Wrapper

Capacitor wrapper for the deployed Khobra web dashboard. Web deployments appear in the app automatically.

## Configure and sync

Set `CAPACITOR_SERVER_URL` to the public HTTPS dashboard URL before syncing:

```powershell
$env:CAPACITOR_SERVER_URL = 'https://your-dashboard.example.com'
npm run sync --workspace @khobra/mobilewrapper
```

For local Android development, run the web app, forward the emulator port, then use the default URL:

```powershell
adb reverse tcp:3000 tcp:3000
npm run dev
npm run run:android --workspace @khobra/mobilewrapper
```

Open native projects with `npm run open:android --workspace @khobra/mobilewrapper` or, on macOS, `npm run open:ios --workspace @khobra/mobilewrapper`.
