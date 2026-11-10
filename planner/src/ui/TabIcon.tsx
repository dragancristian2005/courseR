import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

/**
 * Icons stroke with currentColor and get the colour through CSS `color`, because SVG attributes
 * can't read the theme's CSS variables on every browser.
 */
const INK = 'currentColor';

export type TabIconName = 'Today' | 'Week' | 'Homework' | 'Notes' | 'Links';

/** Simple 24px line icons for the tab bar, drawn in the tab's text colour. */
export function TabIcon({
  name,
  color,
  size = 22,
}: {
  name: TabIconName;
  color: string;
  size?: number;
}) {
  const p = {
    stroke: INK,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg
      testID={`tab-icon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      color={color}
      // On the web the CSS colour (a theme variable) wins over the attribute.
      style={{ color } as object}
    >
      {name === 'Today' ? (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={3} {...p} />
          <Line x1={3} y1={10} x2={21} y2={10} {...p} />
          <Line x1={8} y1={3} x2={8} y2={7} {...p} />
          <Line x1={16} y1={3} x2={16} y2={7} {...p} />
          <Circle cx={12} cy={15.5} r={2} fill={INK} />
        </>
      ) : name === 'Week' ? (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={3} {...p} />
          <Line x1={9} y1={4} x2={9} y2={20} {...p} />
          <Line x1={15} y1={4} x2={15} y2={20} {...p} />
          <Line x1={3} y1={12} x2={21} y2={12} {...p} />
        </>
      ) : name === 'Homework' ? (
        <>
          <Path d="M4 6.5l1.8 1.8L9 5" {...p} />
          <Line x1={12} y1={7} x2={20} y2={7} {...p} />
          <Path d="M4 14.5l1.8 1.8L9 13" {...p} />
          <Line x1={12} y1={15} x2={20} y2={15} {...p} />
        </>
      ) : name === 'Notes' ? (
        <>
          <Path d="M6 3h8l4 4v14H6z" {...p} />
          <Path d="M14 3v4h4" {...p} />
          <Line x1={9} y1={12} x2={15} y2={12} {...p} />
          <Line x1={9} y1={16} x2={13} y2={16} {...p} />
        </>
      ) : (
        <>
          <Path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" {...p} />
          <Path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" {...p} />
        </>
      )}
    </Svg>
  );
}

/** Gear icon for the Settings button on Today. */
export function SettingsIcon({ color, size = 24 }: { color: string; size?: number }) {
  const p = {
    stroke: INK,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg
      testID="settings-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      color={color}
      // On the web the CSS colour (a theme variable) wins over the attribute.
      style={{ color } as object}
    >
      <Circle cx={12} cy={12} r={3} {...p} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        {...p}
      />
    </Svg>
  );
}
