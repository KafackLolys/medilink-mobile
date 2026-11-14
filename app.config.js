/**
 * Android distribution config. Never commit a Firebase Admin service-account key.
 * EAS credentials and the Google services file belong to protected EAS environments.
 * The canonical package and project ID must be approved by the product owner.
 */
const appIdPattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const projectIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const packageName = process.env.MEDILINK_ANDROID_PACKAGE?.trim();
  const googleServicesFile = process.env.MEDILINK_GOOGLE_SERVICES_FILE?.trim();
  const projectId = process.env.MEDILINK_EAS_PROJECT_ID?.trim();
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (packageName && !appIdPattern.test(packageName)) {
    throw new Error('MEDILINK_ANDROID_PACKAGE doit être un identifiant Android inversé valide.');
  }
  if (projectId && !projectIdPattern.test(projectId)) {
    throw new Error('MEDILINK_EAS_PROJECT_ID doit être un identifiant de projet EAS UUID valide.');
  }
  if (profile) {
    if (!['development', 'preview', 'production'].includes(profile)) {
      throw new Error('Profil EAS inconnu.');
    }
    if (profile === 'production' &&
        (process.env.MEDILINK_BRANDING_APPROVED !== 'true' ||
         process.env.MEDILINK_VERSION_CODE_APPROVED !== 'true')) {
      throw new Error('Build production bloqué : identité visuelle et versionCode Google Play non approuvés.');
    }
    if (!packageName || !googleServicesFile || !projectId) {
      throw new Error('Build bloqué : identifiant Android, projet EAS et fichier Firebase Android sont requis.');
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
