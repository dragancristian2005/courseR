import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import HomeworkTab from "../../app/(tabs)/homework";
import EditHomework from "../../app/homework/edit";
import { createMemoryRepository } from "../../src/data/memoryRepository";
import { StoreProvider } from "../../src/data/StoreProvider";
import type { Homework, PlannerData, Subject } from "../../src/domain/types";

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
const hw = (over: Partial<Homework>): Homework => ({
  id: "h1",
  updatedAt: 1,
  title: "Problem set 3",
  subjectId: "tss",
  due: "2026-11-03",
  dueTime: null,
  done: false,
  ...over,
});
const base: Partial<PlannerData> = {
  subjects: [tss, web],
  homework: [
    hw({}),
    hw({ id: "h2", title: "Essay", subjectId: "web", due: "2026-11-20" }),
    hw({
      id: "h3",
      title: "Quiz prep",
      subjectId: null,
      due: "2026-11-01",
      done: true,
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
  jest.setSystemTime(new Date(2026, 10, 2, 10, 25));
  jest.clearAllMocks();
  mockParams = {};
});
afterEach(() => jest.useRealTimers());

describe("Homework tab", () => {
  it("groups into This week, Later and a collapsed Done", async () => {
    await setup(HomeworkTab);
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("Problem set 3")).toBeTruthy();
    expect(screen.getByText("Teoria Sistemelor")).toBeTruthy();
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.getByText("Later")).toBeTruthy();
    expect(screen.getByText("Essay")).toBeTruthy();
    expect(screen.getByText("20 Nov")).toBeTruthy();
    expect(screen.getByText("Done (1) ›")).toBeTruthy();
    expect(screen.queryByText("Quiz prep")).toBeNull();
  });

  it("expands Done and unticking upserts done:false", async () => {
    const { upsert } = await setup(HomeworkTab);
    await press("Done (1) ›");
    expect(screen.getByText("Quiz prep")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("checkbox", { name: "Quiz prep, done" }),
    );
    expect(upsert).toHaveBeenCalledWith(
      "homework",
      expect.objectContaining({ id: "h3", done: false }),
    );
  });

  it("ticking a row upserts done:true", async () => {
    const { upsert } = await setup(HomeworkTab);
    await fireEvent.press(
      screen.getByRole("checkbox", { name: "Problem set 3, not done" }),
    );
    expect(upsert).toHaveBeenCalledWith(
      "homework",
      expect.objectContaining({ id: "h1", done: true }),
    );
    expect(upsert.mock.calls[0][1].updatedAt).toBe(Date.now());
  });

  it("shows the empty state and Add homework", async () => {
    await setup(HomeworkTab, { subjects: [tss] });
    expect(
      screen.getByText("Nothing due. Add homework when you get it."),
    ).toBeTruthy();
    await press("Add homework");
    expect(router.push).toHaveBeenCalledWith("/homework/edit");
  });

  it("opens the editor when a row is tapped", async () => {
    await setup(HomeworkTab);
    await fireEvent.press(screen.getByText("Essay"));
    expect(router.push).toHaveBeenCalledWith("/homework/edit?id=h2");
  });
});

describe("Homework form", () => {
  it("validates after touch and saves a new homework", async () => {
    mockParams = { subjectId: "web" };
    const { upsert } = await setup(EditHomework);
    expect(screen.queryByText("Give the homework a title.")).toBeNull();
    await type("Title", "x");
    await type("Title", "");
    expect(screen.getByText("Give the homework a title.")).toBeTruthy();
    await type("Due date", "tomorrow");
    expect(screen.getByText("Enter a date like 2026-11-09.")).toBeTruthy();
    await type("Due time", "9h");
    expect(screen.getByText("Enter a time like 09:40.")).toBeTruthy();
    await type("Title", "Lab report");
    await type("Due date", "2026-11-09");
    await type("Due time", "");
    await press("Save homework");
    expect(upsert).toHaveBeenCalledTimes(1);
    const saved = upsert.mock.calls[0][1] as Homework;
    expect(saved).toMatchObject({
      title: "Lab report",
      subjectId: "web",
      due: "2026-11-09",
      dueTime: null,
      done: false,
    });
    expect(saved.id.length).toBeGreaterThan(5);
    expect(router.back).toHaveBeenCalled();
  });

  it("lets the subject be cleared", async () => {
    const { upsert } = await setup(EditHomework);
    await type("Title", "Read");
    await type("Due date", "2026-11-09");
    await fireEvent.press(screen.getByRole("radio", { name: "No subject" }));
    await press("Save homework");
    expect((upsert.mock.calls[0][1] as Homework).subjectId).toBeNull();
  });

  it("edits an existing homework", async () => {
    mockParams = { id: "h1" };
    const { upsert } = await setup(EditHomework);
    expect(screen.getByText("Edit homework")).toBeTruthy();
    expect(screen.getByLabelText("Title").props.value).toBe("Problem set 3");
    await type("Due time", "09:40");
    await press("Save homework");
    expect(upsert).toHaveBeenCalledWith(
      "homework",
      expect.objectContaining({ id: "h1", dueTime: "09:40", subjectId: "tss" }),
    );
  });

  it("deletes with confirmation, or keeps it", async () => {
    mockParams = { id: "h1" };
    const { remove } = await setup(EditHomework);
    await press("Delete homework");
    expect(screen.getByText("Delete this homework?")).toBeTruthy();
    await press("Keep it");
    expect(remove).not.toHaveBeenCalled();
    await press("Delete homework");
    await press("Delete");
    expect(remove).toHaveBeenCalledWith("homework", "h1");
    expect(router.back).toHaveBeenCalled();
  });

  it("has no delete button for a new homework", async () => {
    await setup(EditHomework);
    expect(
      screen.queryByRole("button", { name: "Delete homework" }),
    ).toBeNull();
  });
});

describe("Missing record", () => {
  it("shows a dead end instead of a create form", async () => {
    mockParams = { id: "gone" };
    const { upsert } = await setup(EditHomework);
    expect(screen.getByText("This item no longer exists.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    await press("Go back");
    expect(router.back).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
