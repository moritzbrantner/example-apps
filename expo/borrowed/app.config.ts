import type { ConfigContext, ExpoConfig } from 'expo/config';

const githubPagesBaseUrl = process.env.EXPO_PUBLIC_GITHUB_PAGES_BASE_URL;
const nativeBundlePrefix = 'io.github.moritzbrantner';

function nativeIdentifier(slug: string) {
  const suffix = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!suffix) {
    throw new Error('Expo app slug must contain at least one ASCII letter or number');
  }
  return `${nativeBundlePrefix}.${suffix}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!config.name || !config.slug) {
    throw new Error('Expo app config requires name and slug');
  }

  const identifier = nativeIdentifier(config.slug);

  return {
    ...config,
    name: config.name,
    slug: config.slug,
    ios: { ...config.ios, bundleIdentifier: config.ios?.bundleIdentifier ?? identifier },
    android: { ...config.android, package: config.android?.package ?? identifier },
    experiments: {
      ...config.experiments,
      ...(githubPagesBaseUrl ? { baseUrl: githubPagesBaseUrl } : {}),
    },
  };
};
