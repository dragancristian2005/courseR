import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

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
    stroke: color,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg testID={`tab-icon-${name}`} width={size} height={size} viewBox="0 0 24 24">
      {name === 'Today' ? (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={3} {...p} />
          <Line x1={3} y1={10} x2={21} y2={10} {...p} />
          <Line x1={8} y1={3} x2={8} y2={7} {...p} />
          <Line x1={16} y1={3} x2={16} y2={7} {...p} />
          <Circle cx={12} cy={15.5} r={2} fill={color} />
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
