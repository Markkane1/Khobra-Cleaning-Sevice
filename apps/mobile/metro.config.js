const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const config = getDefaultConfig(__dirname)
config.server.unstable_serverRoot = process.argv.includes('export:embed')
  ? __dirname
  : path.resolve(__dirname, '../..')

module.exports = config
