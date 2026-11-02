import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { theme } from './theme';

export type TextVariant = 'title' | 'body' | 'meta' | 'time' | 'note';

const variants: Record<TextVariant, TextStyle> = {
  title: { fontFamily: theme.font.appBold, fontSize: 22, color: theme.color.ink },
  body: { fontFamily: theme.font.app, fontSize: 16, color: theme.color.ink },
  meta: { fontFamily: theme.font.app, fontSize: 13, color: theme.color.muted },
  time: {
    fontFamily: theme.font.app,
    fontSize: 14,
    color: theme.color.ink,
    fontVariant: ['tabular-nums'],
  },
  note: { fontFamily: theme.font.note, fontSize: 16, color: theme.color.ink },
};

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: TextVariant }) {
  return <RNText {...rest} style={[variants[variant], style]} />;
}
