/**
 * Android distribution config. Never commit a Firebase Admin service-account key.
 * EAS credentials and the Google services file belong to protected EAS environments.
 * The canonical package and project ID must be approved by the product owner.
 */
const fs = require('node:fs');
const path = require('node:path');
const appIdPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const projectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const packageName = (
    process.env.MEDILINK_ANDROID_PACKAGE ||
    config.android?.package ||
    'com.lolys.medilink'
  ).trim();
  const googleServicesFile = process.env.MEDILINK_GOOGLE_SERVICES_FILE?.trim() || config.android?.googleServicesFile || './google-services.json';
  // The existing Expo project ID is already tracked in app.json.
  // Requiring an unrelated duplicate environment variable prevented ordinary
  // development/preview builds before native Android was even compiled.
  const projectId = process.env.MEDILINK_EAS_PROJECT_ID?.trim() ||
    config.extra?.eas?.projectId?.trim();
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (packageName && !appIdPattern.test(packageName)) {
    throw new Error('MEDILINK_ANDROID_PACKAGE doit être un identifiant Android inversé valide.');
  }
  if (projectId && !projectIdPattern.test(projectId)) {
    throw new Error('MEDILINK_EAS_PROJECT_ID doit être un identifiant de projet EAS UUID valide.');
  }
  // Fail early on mismatched Firebase project/package; FCM would otherwise fail silently.
  if (profile) {
    if (!fs.existsSync(path.resolve(googleServicesFile))) {
      throw new Error('Build bloqué : fichier de configuration Firebase Android introuvable.');
    }
    try {
      const firebase = JSON.parse(fs.readFileSync(path.resolve(googleServicesFile), 'utf8'));
      const declaredPackages = (firebase.client ?? []).map(c => c.client_info?.android_client_info?.package_name);
      if (!declaredPackages.includes(packageName) || !firebase.project_info?.project_id) {
        throw new Error('Configuration Firebase Android non concordante avec le package Android.');
      }
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error('Format de configuration Firebase Android invalide.');
      throw error;
    }

    if (!['development', 'preview', 'production'].includes(profile)) {
      throw new Error('Profil EAS inconnu.');
    }
    if (profile === 'production' &&
      (process.env.MEDILINK_BRANDING_APPROVED !== 'true' ||
        process.env.MEDILINK_VERSION_CODE_APPROVED !== 'true')) {
      throw new Error('Build production bloqué : identité visuelle et versionCode Google Play non approuvés.');
    }
    if (!packageName || !projectId) {
      throw new Error('Build bloqué : identifiant Android ou projet EAS manquant.');
    }
    if (!apiUrl) {
      throw new Error('Build bloqué : EXPO_PUBLIC_API_BASE_URL est requis.');
    }
    const url = new URL(apiUrl);
    if (url.username || url.password || url.search || url.hash ||
      (profile !== 'development' && url.protocol !== 'https:') ||
      (profile === 'development' && !['https:', 'http:'].includes(url.protocol))) {
      throw new Error('URL API invalide ou non sécurisée pour ce profil Android.');
    }
    if (profile !== 'development' && /^(localhost|127\.0\.0\.1|10\.0\.2\.2|api\.example\.com)$/i.test(url.hostname)) {
      throw new Error('Build bloqué : URL API de démonstration ou locale interdite.');
    }
  }
  return {
    ...config,
    android: {
      ...config.android,
      ...(packageName ? { package: packageName } : {}),
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
