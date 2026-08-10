$ErrorActionPreference = 'Stop'

$env:CAPACITOR_SERVER_URL = 'https://khobraapp.duckdns.org'
$env:ANDROID_KEYSTORE_PATH = (Resolve-Path (Join-Path $PSScriptRoot '..\khobra-web-release.jks')).Path
$env:ANDROID_KEY_ALIAS = 'khobra-web'
$env:ANDROID_VERSION_CODE = '2'
$env:ANDROID_VERSION_NAME = '1.0.1'

$securePassword = Read-Host 'Enter keystore password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

$env:ANDROID_KEYSTORE_PASSWORD = $password
$env:ANDROID_KEY_PASSWORD = $password

try {
  npm.cmd run sync:production
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }

  Push-Location android
  try {
    .\gradlew.bat bundleRelease assembleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed' }
  } finally {
    Pop-Location
  }

  Write-Host ''
  Write-Host 'APK and AAB built successfully.' -ForegroundColor Green
  Write-Host 'APK: android\app\build\outputs\apk\release\app-release.apk'
  Write-Host 'AAB: android\app\build\outputs\bundle\release\app-release.aab'
} finally {
  Remove-Item Env:ANDROID_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
  $password = $null
}
