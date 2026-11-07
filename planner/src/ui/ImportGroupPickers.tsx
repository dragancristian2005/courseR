import { Chips } from './FormBits';
import { Rule } from './Rule';
import { Text } from './Text';

/** The sheet's title and the group (and semigroup) choice. Choosing the same label again does nothing. */
export function ImportGroupPickers({
  title,
  groups,
  semigroups,
  group,
  semigroup,
  onGroup,
  onSemigroup,
}: {
  title: string | null;
  groups: string[];
  semigroups: string[];
  group: string | null;
  semigroup: string | null;
  onGroup: (g: string) => void;
  onSemigroup: (g: string) => void;
}) {
  const offer = (
    label: string,
    options: string[],
    value: string | null,
    on: (g: string) => void,
  ) => (
    <Chips
      label={label}
      options={options.map((g) => ({ value: g, label: g }))}
      value={value}
      onChange={(g) => {
        if (g !== value) on(g);
      }}
    />
  );
  return (
    <>
      <Rule weight="heavy" />
      {title ? <Text variant="meta">{title}</Text> : null}
      {groups.length > 0 ? offer('Which group are you in?', groups, group, onGroup) : null}
      {semigroups.length > 0 && (groups.length === 0 || group !== null)
        ? offer('Which semigroup?', semigroups, semigroup, onSemigroup)
        : null}
    </>
  );
}
