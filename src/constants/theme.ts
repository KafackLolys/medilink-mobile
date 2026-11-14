import { Platform } from 'react-native';

/** Derived from the web app's globals.css brand tokens; contrast-adjusted for native UI. */
export const Colors = {
  light: {
    text: '#1E293B', background: '#F8FAFC', backgroundElement: '#FFFFFF',
    backgroundSelected: '#DBEAFE', textSecondary: '#64748B',
    primary: '#2563EB', onPrimary: '#FFFFFF', secondary: '#0D9488',
    night: '#0F1F4A', border: '#CBD5E1', input: '#FFFFFF',
    success: '#15803D', warning: '#92400E', danger: '#B91C1C',
    successSurface: '#DCFCE7', warningSurface: '#FEF3C7', dangerSurface: '#FEE2E2',
    infoSurface: '#EFF6FF', overlay: 'rgba(15,23,42,0.65)',
  },
  dark: {
    text: '#F1F5F9', background: '#0F172A', backgroundElement: '#1E293B',
    backgroundSelected: '#1E3A8A', textSecondary: '#CBD5E1',
    primary: '#93C5FD', onPrimary: '#0F172A', secondary: '#5EEAD4',
    night: '#F1F5F9', border: '#475569', input: '#1E293B',
    success: '#86EFAC', warning: '#FCD34D', danger: '#FCA5A5',
    successSurface: '#14532D', warningSurface: '#78350F', dangerSurface: '#7F1D1D',
    infoSurface: '#1E3A8A', overlay: 'rgba(0,0,0,0.75)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 8, medium: 10, large: 12, xlarge: 18, pill: 999 } as const;
export const Typography = {
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
  small: { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  subtitle: { fontSize: 22, lineHeight: 30, fontWeight: '700' },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800' },
} as const;
export const MinimumTouchTarget = 48;
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'system-ui', serif: 'Georgia', rounded: 'system-ui', mono: 'monospace' },
})!;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
