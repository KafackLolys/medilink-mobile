import { Text, type TextProps } from 'react-native';
import { Fonts, Typography, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const variant = {
    default: Typography.body,
    title: Typography.title,
    subtitle: Typography.subtitle,
    small: Typography.small,
    smallBold: Typography.label,
    link: Typography.small,
    linkPrimary: Typography.label,
    code: { fontSize: 12, lineHeight: 18, fontFamily: Fonts.mono },
  }[type];

  return (
    <Text
      allowFontScaling
      style={[{ color: theme[themeColor ?? (type === 'linkPrimary' ? 'primary' : 'text')] }, variant, style]}
      {...rest}
    />
  );
}
