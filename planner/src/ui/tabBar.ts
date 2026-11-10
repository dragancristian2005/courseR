/** Gap between the floating tab bar and the bottom edge, above the home indicator if any. */
export const TAB_BAR_LIFT = 12;

/** Bottom padding under the floating tab bar: the safe area (at least 4px) plus a lift. */
export function tabBarBottomPad(bottomInset: number): number {
  return Math.max(bottomInset, 4) + TAB_BAR_LIFT;
}
