/**
 * Production Android FCM setup:
 * - MEDILINK_ANDROID_PACKAGE must match Firebase's registered Android app.
 * - MEDILINK_GOOGLE_SERVICES_FILE points to a google-services.json supplied
 *   by a secure build environment (EAS file-type environment variable).
 * Never include Firebase service-account private keys in the mobile project.
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.MEDILINK_ANDROID_PACKAGE
      ? { package: process.env.MEDILINK_ANDROID_PACKAGE }
      : {}),
    ...(process.env.MEDILINK_GOOGLE_SERVICES_FILE
      ? { googleServicesFile: process.env.MEDILINK_GOOGLE_SERVICES_FILE }
      : {}),
  },
});
