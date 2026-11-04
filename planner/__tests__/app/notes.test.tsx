import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import Notes from "../../app/(tabs)/notes";
import EditNote from "../../app/note/edit";
import { createMemoryRepository } from "../../src/data/memoryRepository";
import { StoreProvider } from "../../src/data/StoreProvider";
import type {
  ClassPattern,
  Note,
  PlannerData,
  Subject,
} from "../../src/domain/types";

let mockParams: { id?: string; sessionId?: string; subjectId?: string } = {};
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
const net: Subject = {
  id: "net",
  updatedAt: 1,
  name: "Administrarea rețelelor",
  abbreviation: "AR",
  attending: true,
};
const p1: ClassPattern = {
  id: "p1",
  updatedAt: 1,
  subjectId: "tss",
  type: "seminar",
  weekday: 1,
  start: "11:20",
  end: "12:50",
  room: "048",
  teacher: "",
  repeat: "every",
  validFrom: "2026-09-28",
  validTo: null,
  online: false,
};
const NOW = new Date(2026, 10, 2, 10, 25).getTime();
const day = (n: number) => NOW - n * 86_400_000;
const note = (over: Partial<Note>): Note => ({
  id: "n1",
  updatedAt: 1,
  text: "Transfer function recap",
  subjectId: "tss",
  sessionId: "p1:2026-11-02",
  createdAt: NOW,
  ...over,
});
const base: Partial<PlannerData> = {
  subjects: [tss, web, net],
  patterns: [p1],
  notes: [
    note({}),
    note({
      id: "n2",
      text: "Ask about the project",
      subjectId: "web",
      sessionId: null,
      createdAt: day(1),
    }),
    note({
      id: "n3",
      text: "Remember the quiz",
      subjectId: null,
      sessionId: null,
      createdAt: day(3),
    }),
    note({
      id: "n4",
      text: "Configurarea retelelor locale",
      subjectId: "net",
      sessionId: null,
      createdAt: day(10),
    }),
    note({
      id: "n5",
      text: "Old idea",
      subjectId: null,
      sessionId: null,
      createdAt: day(20),
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
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  jest.clearAllMocks();
  mockParams = {};
});
afterEach(() => jest.useRealTimers());

describe("Notes tab", () => {
  it("lists newest first with link lines and age labels", async () => {
    await setup(Notes);
    expect(screen.getByText("TSS, seminar on Mon 2 Nov")).toBeTruthy();
    expect(screen.getByText("Tehnologii web, whole subject")).toBeTruthy();
    expect(screen.getAllByText("Not linked")).toHaveLength(2);
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Yesterday")).toBeTruthy();
    expect(screen.getByText("3 days ago")).toBeTruthy();
    expect(screen.getByText("Last week")).toBeTruthy();
    expect(screen.getByText("13 Oct")).toBeTruthy();
    const texts = screen
      .getAllByTestId("note-text")
      .map((n) => n.props.children);
    expect(texts[0]).toBe("Transfer function recap");
    expect(texts[4]).toBe("Old idea");
  });

  it("search ignores diacritics and case", async () => {
    await setup(Notes);
    await type("Search notes", "retelelor");
    expect(screen.getByText("Configurarea retelelor locale")).toBeTruthy();
    expect(screen.queryByText("Old idea")).toBeNull();
    await type("Search notes", "rețelelor");
    expect(screen.getByText("Configurarea retelelor locale")).toBeTruthy();
    await type("Search notes", "SEMINAR");
    expect(screen.getByText("Transfer function recap")).toBeTruthy();
    expect(screen.queryByText("Remember the quiz")).toBeNull();
    await type("Search notes", "tehnologii");
    expect(screen.getByText("Ask about the project")).toBeTruthy();
    await type("Search notes", "zzz");
    expect(screen.getByText("No notes match “zzz”.")).toBeTruthy();
  });

  it("filters by subjectId and Show all clears it", async () => {
    mockParams = { subjectId: "tss" };
    await setup(Notes);
    expect(screen.getByText("Showing TSS notes")).toBeTruthy();
    expect(screen.getByText("Transfer function recap")).toBeTruthy();
    expect(screen.queryByText("Old idea")).toBeNull();
    await press("Show all");
    expect(router.replace).toHaveBeenCalledWith("/notes");
  });

  it("shows empty state, New note and opens the editor", async () => {
    await setup(Notes, { subjects: [tss] });
    expect(
      screen.getByText("No notes yet. Write one during class."),
    ).toBeTruthy();
    await press("New note");
    expect(router.push).toHaveBeenCalledWith("/note/edit");
  });

  it("opens a note on tap", async () => {
    await setup(Notes);
    await fireEvent.press(screen.getByText("Old idea"));
    expect(router.push).toHaveBeenCalledWith("/note/edit?id=n5");
  });
});

describe("Note editor", () => {
  it("stores both sessionId and subjectId for a class note", async () => {
    mockParams = { sessionId: "p1:2026-11-02", subjectId: "tss" };
    const { upsert } = await setup(EditNote, { ...base, notes: [] });
    expect(
      screen.getByRole("radio", {
        name: "This class: TSS seminar on Mon 2 Nov",
        selected: true,
      }),
    ).toBeTruthy();
    await type("Text", "x");
    await type("Text", "");
    expect(screen.getByText("Write something first.")).toBeTruthy();
    await type("Text", "Poles and zeros");
    await press("Save note");
    const saved = upsert.mock.calls[0][1] as Note;
    expect(upsert.mock.calls[0][0]).toBe("notes");
    expect(saved).toMatchObject({
      text: "Poles and zeros",
      sessionId: "p1:2026-11-02",
      subjectId: "tss",
      createdAt: Date.now(),
    });
    expect(router.back).toHaveBeenCalled();
  });

  it("offers Not linked and subjects, and saves a subject note", async () => {
    const { upsert } = await setup(EditNote, { ...base, notes: [] });
    expect(
      screen.getByRole("radio", { name: "Not linked", selected: true }),
    ).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /This class/ })).toBeNull();
    await fireEvent.press(
      screen.getByRole("radio", { name: "Tehnologii web, whole subject" }),
    );
    await type("Text", "Idea");
    await press("Save note");
    expect(upsert.mock.calls[0][1]).toMatchObject({
      subjectId: "web",
      sessionId: null,
    });
  });

  it("edits and deletes a note, keeping createdAt", async () => {
    mockParams = { id: "n1" };
    const { upsert, remove } = await setup(EditNote);
    expect(screen.getByText("Edit note")).toBeTruthy();
    expect(screen.getByLabelText("Text").props.value).toBe(
      "Transfer function recap",
    );
    await type("Text", "Changed");
    await press("Save note");
    expect(upsert).toHaveBeenCalledWith(
      "notes",
      expect.objectContaining({
        id: "n1",
        text: "Changed",
        createdAt: NOW,
        sessionId: "p1:2026-11-02",
        subjectId: "tss",
      }),
    );
    await press("Delete note");
    expect(screen.getByText("Delete this note?")).toBeTruthy();
    await press("Delete");
    expect(remove).toHaveBeenCalledWith("notes", "n1");
  });
});
