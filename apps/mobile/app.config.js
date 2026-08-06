const app = require('./app.json').expo

module.exports = {
  ...app,
  android: {
    ...app.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || app.android.googleServicesFile,
  },
}
