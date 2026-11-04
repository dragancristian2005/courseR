import React from "react";
import { Text } from "react-native";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import TabLayout from "../../app/(tabs)/_layout";
import { useLayout } from "../../src/ui/useLayout";

jest.mock("../../src/ui/useLayout", () => ({ useLayout: jest.fn() }));

const page = (name: string) => () => <Text>{`page ${name}`}</Text>;
const routes = {
  "(tabs)/_layout": TabLayout,
  "(tabs)/index": page("today"),
  "(tabs)/week": page("week"),
  "(tabs)/homework": page("homework"),
  "(tabs)/notes": page("notes"),
  "(tabs)/links": page("links"),
  "settings/index": page("settings"),
};
const labels = ["Today", "Week", "Homework", "Notes", "Links"];

describe("tabs layout", () => {
  it("phone: bottom tab bar with text labels and no Settings", async () => {
    (useLayout as jest.Mock).mockReturnValue("phone");
    await renderRouter(routes, { initialUrl: "/" });
    for (const l of labels) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.queryByText("Settings")).toBeNull();
    expect(screen.getAllByRole("tab")[0].parent?.props.accessibilityRole).toBe(
      "tablist",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByText("page today")).toBeTruthy();
  });

  it("wide: sidebar with the labels plus Settings, which navigates to /settings", async () => {
    (useLayout as jest.Mock).mockReturnValue("wide");
    await renderRouter(routes, { initialUrl: "/" });
    for (const l of labels) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.getByLabelText("Sidebar")).toBeTruthy();
    expect(screen.getAllByRole("tab")[0].parent?.props.accessibilityRole).toBe(
      "tablist",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    await fireEvent.press(screen.getByText("Week"));
    expect(await screen.findByText("page week")).toBeTruthy();
    await fireEvent.press(screen.getByText("Settings"));
    expect(await screen.findByText("page settings")).toBeTruthy();
  });
});
