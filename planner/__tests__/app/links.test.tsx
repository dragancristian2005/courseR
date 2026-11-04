import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import Links from "../../app/(tabs)/links";
import EditLink from "../../app/link/edit";
import { createMemoryRepository } from "../../src/data/memoryRepository";
import { StoreProvider } from "../../src/data/StoreProvider";
import { normalizeLinkUrl } from "../../src/domain/links";
import type { Link, PlannerData, Subject } from "../../src/domain/types";

let mockParams: { id?: string; subjectId?: string } = {};
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => mockParams,
}));

const tss: Subject = {
  id: "tss",
  updatedAt: 1,
  name: "Teoria Sistemelor",
  abbreviation: "TSS",
  attending: true,
};
const web: Subject = {
  id: "web",
  updatedAt: 1,
  name: "Tehnologii web",
  abbreviation: "TW",
  attending: true,
};
const skipped: Subject = {
  id: "sk",
  updatedAt: 1,
  name: "Skipped",
  abbreviation: "SK",
  attending: false,
};
const link = (over: Partial<Link>): Link => ({
  id: "l1",
  updatedAt: 1,
  title: "Student portal",
  url: "https://portal.uvt.ro",
  subjectId: null,
  ...over,
});
const base: Partial<PlannerData> = {
  subjects: [tss, web, skipped],
  links: [
    link({}),
    link({
      id: "l2",
      title: "Course page",
      url: "https://example.com/tss",
      subjectId: "tss",
    }),
    link({
      id: "l3",
      title: "Evil",
      url: "javascript:alert(1)",
      subjectId: null,
    }),
  ],
};

async function setup(
  Screen: React.ComponentType,
  initial: Partial<PlannerData> = base,
) {
  const repo = createMemoryRepository(initial);
  const upsert = jest.spyOn(repo, "upsert");
  const remove = jest.spyOn(repo, "remove");
  await render(
    <StoreProvider repository={repo}>
      <Screen />
    </StoreProvider>,
  );
  return { repo, upsert, remove };
}
const press = async (name: string) =>
  await fireEvent.press(screen.getByRole("button", { name }));
const type = async (label: string, value: string) =>
  await fireEvent.changeText(screen.getByLabelText(label), value);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

describe("normalizeLinkUrl", () => {
  it("trims, adds https and leaves schemes alone", () => {
    expect(normalizeLinkUrl("  portal.uvt.ro ")).toBe("https://portal.uvt.ro");
    expect(normalizeLinkUrl("http://a.ro")).toBe("http://a.ro");
    expect(normalizeLinkUrl("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
});

describe("Links tab", () => {
  it("shows University and By subject sections", async () => {
    await setup(Links);
    expect(screen.getByText("University")).toBeTruthy();
    expect(screen.getByText("By subject")).toBeTruthy();
    expect(screen.getByText("Student portal")).toBeTruthy();
    expect(screen.getByText("TSS")).toBeTruthy();
    expect(screen.getByText("Course page")).toBeTruthy();
    expect(screen.getByText("TW")).toBeTruthy();
    expect(
      screen.getByText("No links yet. Add one from the class."),
    ).toBeTruthy();
    expect(screen.queryByText("SK")).toBeNull();
  });

  it("opens safe links through Linking and ignores unsafe ones", async () => {
    await setup(Links);
    await fireEvent.press(screen.getByText("Student portal"));
    expect(Linking.openURL).toHaveBeenCalledWith("https://portal.uvt.ro");
    await fireEvent.press(screen.getByText("Evil"));
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });

  it("Edit button opens the editor and Add link adds", async () => {
    await setup(Links);
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit Course page" }),
    );
    expect(router.push).toHaveBeenCalledWith("/link/edit?id=l2");
    await press("Add link");
    expect(router.push).toHaveBeenCalledWith("/link/edit");
  });
});

describe("Link form", () => {
  it("saves portal.uvt.ro as https://portal.uvt.ro", async () => {
    mockParams = { subjectId: "web" };
    const { upsert } = await setup(EditLink);
    expect(
      screen.getByRole("radio", { name: "Tehnologii web", selected: true }),
    ).toBeTruthy();
    await type("Title", "x");
    await type("Title", "");
    expect(screen.getByText("Give the link a name.")).toBeTruthy();
    await type("Title", "Portal");
    await type("Address", "  portal.uvt.ro ");
    await press("Save link");
    expect(upsert).toHaveBeenCalledWith(
      "links",
      expect.objectContaining({
        title: "Portal",
        url: "https://portal.uvt.ro",
        subjectId: "web",
      }),
    );
    expect(router.back).toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "data:text/html,<b>x</b>"])(
    "rejects %s",
    async (bad) => {
      const { upsert } = await setup(EditLink);
      await type("Title", "Bad");
      await type("Address", bad);
      expect(
        screen.getByText("Use a web address that starts with https://."),
      ).toBeTruthy();
      await press("Save link");
      expect(upsert).not.toHaveBeenCalled();
    },
  );

  it("requires an address after touch", async () => {
    await setup(EditLink);
    await type("Address", "a");
    await type("Address", "");
    expect(screen.getByText("Enter a web address.")).toBeTruthy();
  });

  it("edits and deletes a link, can move it to University", async () => {
    mockParams = { id: "l2" };
    const { upsert, remove } = await setup(EditLink);
    expect(screen.getByText("Edit link")).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "University" }));
    await press("Save link");
    expect(upsert).toHaveBeenCalledWith(
      "links",
      expect.objectContaining({ id: "l2", subjectId: null }),
    );
    await press("Delete link");
    expect(screen.getByText("Delete this link?")).toBeTruthy();
    await press("Delete");
    expect(remove).toHaveBeenCalledWith("links", "l2");
  });
});

describe("Missing record", () => {
  it("shows a dead end instead of a create form", async () => {
    mockParams = { id: "gone" };
    const { upsert } = await setup(EditLink);
    expect(screen.getByText("This item no longer exists.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    await press("Go back");
    expect(router.back).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
