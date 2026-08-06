const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
// ponytail: SDK 54 resolves Gradle's relative entry from the workspace server root; remove when Expo preserves the app-relative entry.
config.server.unstable_serverRoot = __dirname

module.exports = config
