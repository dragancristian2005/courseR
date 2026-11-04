import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import SubjectsScreen from "../../app/settings/subjects";
import { createMemoryRepository } from "../../src/data/memoryRepository";
import { StoreProvider } from "../../src/data/StoreProvider";
import type {
  ClassPattern,
  PlannerData,
  Subject,
} from "../../src/domain/types";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));

const sub = (
  id: string,
  name: string,
  abbreviation: string,
  attending = true,
): Subject => ({
  id,
  name,
  abbreviation,
  attending,
  updatedAt: 1,
});
const pat = (
  id: string,
  subjectId: string,
  type: ClassPattern["type"],
): ClassPattern => ({
  id,
  subjectId,
  type,
  weekday: 1,
  start: "08:00",
  end: "09:30",
  room: "",
  teacher: "",
  repeat: "every",
  validFrom: "2026-09-28",
  validTo: null,
  online: false,
  updatedAt: 1,
});
const base: Partial<PlannerData> = {
  subjects: [
    sub("rpa", "Rețele și protocoale", "RPA"),
    sub("tss", "Teoria Sistemelor", "TSS"),
    sub("alg", "Algebra", "ALG", false),
    sub("mat", "Matematică", "MAT"),
  ],
  patterns: [
    pat("p1", "rpa", "course"),
    pat("p2", "rpa", "seminar"),
    pat("p3", "rpa", "lab"),
    pat("p4", "tss", "seminar"),
    pat("p5", "tss", "course"),
    pat("p6", "tss", "course"),
  ],
};

async function setup(initial: Partial<PlannerData> = base) {
  const repo = createMemoryRepository(initial);
  const upsert = jest.spyOn(repo, "upsert");
  await render(
    <StoreProvider repository={repo}>
      <SubjectsScreen />
    </StoreProvider>,
  );
  return { repo, upsert };
}
const press = async (name: string) =>
  await fireEvent.press(screen.getByRole("button", { name }));
const type = async (label: string, value: string) =>
  await fireEvent.changeText(screen.getByLabelText(label), value);
const toggle = async (name: string, value: boolean) => {
  expect(
    screen.getByRole("switch", { name }).props.accessibilityState.checked,
  ).toBe(!value);
  await fireEvent.press(screen.getByRole("switch", { name }));
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 10, 25));
});
afterEach(() => jest.useRealTimers());

describe("Subjects", () => {
  it("shows the explainer, detail lines and sorted lists", async () => {
    await setup();
    expect(
      screen.getByText(
        "Switch off what you don’t attend. It disappears from your calendar, reminders and widgets, and you can switch it back on anytime.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Attending")).toBeTruthy();
    expect(screen.getByText("Not attending")).toBeTruthy();
    expect(screen.getByText("RPA, course, seminar and lab")).toBeTruthy();
    expect(screen.getByText("TSS, course and seminar")).toBeTruthy();
    expect(screen.getByText("MAT, no classes yet")).toBeTruthy();
    expect(screen.getByText("ALG, no classes yet")).toBeTruthy();
    const names = screen
      .getAllByRole("switch")
      .map((s) => s.props.accessibilityLabel);
    expect(names).toEqual([
      "Matematică",
      "Rețele și protocoale",
      "Teoria Sistemelor",
      "Algebra",
    ]);
  });

  it("switching RPA off moves it to Not attending, and back on again", async () => {
    const { upsert } = await setup();
    await toggle("Rețele și protocoale", false);
    expect(upsert).toHaveBeenCalledWith(
      "subjects",
      expect.objectContaining({
        id: "rpa",
        attending: false,
        updatedAt: Date.now(),
      }),
    );
    const names = screen
      .getAllByRole("switch")
      .map((s) => s.props.accessibilityLabel);
    expect(names.slice(-2)).toEqual(["Algebra", "Rețele și protocoale"]);
    jest.setSystemTime(new Date(2026, 10, 2, 10, 26));
    await toggle("Rețele și protocoale", true);
    expect(upsert).toHaveBeenLastCalledWith(
      "subjects",
      expect.objectContaining({ id: "rpa", attending: true }),
    );
    expect(
      screen
        .getAllByRole("switch")
        .map((s) => s.props.accessibilityLabel)
        .slice(-1),
    ).toEqual(["Algebra"]);
  });

  it("adds a subject with initials as the default short name", async () => {
    const { upsert } = await setup({ subjects: [] });
    expect(
      screen.getByText(
        "No subjects yet. Add one, or add a class and its subject is created for you.",
      ),
    ).toBeTruthy();
    await press("Add a subject by hand");
    await type("Name", "Teoria Sistemelor");
    expect(screen.getByLabelText("Short name").props.value).toBe("TS");
    await press("Save subject");
    const s = upsert.mock.calls[0][1] as Subject;
    expect(upsert.mock.calls[0][0]).toBe("subjects");
    expect(s).toEqual(
      expect.objectContaining({
        name: "Teoria Sistemelor",
        abbreviation: "TS",
        attending: true,
      }),
    );
    expect(s.id).toBeTruthy();
    expect(screen.getByText("TS, no classes yet")).toBeTruthy();
  });

  it("validates the subject form", async () => {
    await setup({ subjects: [] });
    await press("Add a subject by hand");
    await type("Name", "x");
    await type("Name", "");
    expect(screen.getByText("Enter the subject’s name.")).toBeTruthy();
    await type("Name", "Algebra");
    await type("Short name", "");
    expect(screen.getByText("Enter a short name.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save subject" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await press("Cancel");
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("edits a subject's name", async () => {
    const { upsert } = await setup();
    await press("Edit Teoria Sistemelor");
    expect(screen.getByLabelText("Short name").props.value).toBe("TSS");
    await type("Name", "Teoria Sistemelor I");
    await press("Save subject");
    expect(upsert).toHaveBeenCalledWith(
      "subjects",
      expect.objectContaining({
        id: "tss",
        name: "Teoria Sistemelor I",
        abbreviation: "TSS",
        attending: true,
      }),
    );
    expect(screen.getByText("Teoria Sistemelor I")).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });
});
