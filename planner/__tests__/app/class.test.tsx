import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Linking } from "react-native";
import { router } from "expo-router";
import ClassScreen from "../../app/class/[sessionId]";
import EditClass from "../../app/class/edit";
import { createMemoryRepository } from "../../src/data/memoryRepository";
import { StoreProvider } from "../../src/data/StoreProvider";
import type {
  ClassPattern,
  PlannerData,
  Semester,
  Subject,
} from "../../src/domain/types";

let mockParams: { sessionId?: string } = {};
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => mockParams,
}));

const semester: Semester = {
  id: "sem",
  updatedAt: 1,
  name: "Autumn",
  firstDay: "2026-09-28",
  lastDay: "2027-01-17",
  breaks: [{ from: "2026-11-09", to: "2026-11-15" }],
  parityOverrides: {},
};
const tss: Subject = {
  id: "tss",
  updatedAt: 1,
  name: "Teoria Sistemelor",
  abbreviation: "TSS",
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
  teacher: "Mutescul A.",
  repeat: "every",
  validFrom: "2026-09-28",
  validTo: null,
  online: false,
};
const base: Partial<PlannerData> = {
  semester,
  subjects: [tss],
  patterns: [p1],
};
const SID = "p1:2026-11-02";

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
const detail = (initial?: Partial<PlannerData>) => {
  mockParams = { sessionId: SID };
  return setup(ClassScreen, initial);
};
const press = async (name: string) =>
  await fireEvent.press(screen.getByRole("button", { name }));
const choose = async (name: string) =>
  await fireEvent.press(screen.getByRole("radio", { name }));
const type = async (label: string, value: string) =>
  await fireEvent.changeText(screen.getByLabelText(label), value);

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 10, 2, 10, 25));
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe("Class detail", () => {
  it("renders the TSS seminar", async () => {
    await detail();
    expect(screen.getByText("Teoria Sistemelor")).toBeTruthy();
    expect(screen.getByText("Seminar, Monday 2 November")).toBeTruthy();
    expect(screen.getByText("11:20 to 12:50")).toBeTruthy();
    expect(screen.getByText("048")).toBeTruthy();
    expect(screen.getByText("Mutescul A.")).toBeTruthy();
    expect(screen.getByText("Every week")).toBeTruthy();
    expect(screen.getByText("Notes from this seminar")).toBeTruthy();
    expect(screen.getByText("All TSS notes")).toBeTruthy();
    expect(screen.getByText("No links yet.")).toBeTruthy();
    expect(screen.getByText("No homework for this subject.")).toBeTruthy();
    expect(screen.getByText("No notes yet.")).toBeTruthy();
  });

  it("shows Online, omits an empty teacher, and shows odd weeks", async () => {
    await detail({
      ...base,
      patterns: [
        {
          ...p1,
          online: true,
          teacher: "",
          repeat: "odd",
          validFrom: "2026-09-28",
        },
      ],
    });
    // 2 Nov is an even week, so the odd pattern has no session that day; use the 26 Oct one
    expect(
      screen.getByText("This class is no longer in your timetable."),
    ).toBeTruthy();
  });

  it("shows Online and Odd weeks for an odd-week online class", async () => {
    mockParams = { sessionId: "p1:2026-10-26" };
    await setup(ClassScreen, {
      ...base,
      patterns: [{ ...p1, online: true, teacher: "", repeat: "odd" }],
    });
    expect(screen.getByText("Online")).toBeTruthy();
    expect(screen.getByText("Odd weeks")).toBeTruthy();
    expect(screen.queryByText("Teacher")).toBeNull();
  });

  it("moves this week, shows the new time, then undoes it", async () => {
    const { upsert, remove } = await detail();
    await press("Move this week");
    await type("Date", "2026-11-03");
    await type("Start", "13:00");
    await type("End", "14:30");
    await press("Save move");
    expect(upsert).toHaveBeenCalledWith(
      "overrides",
      expect.objectContaining({
        id: "ov_p1_2026-11-02",
        sessionId: SID,
        kind: "moved",
        date: "2026-11-03",
        start: "13:00",
        end: "14:30",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("13:00 to 14:30")).toBeTruthy(),
    );
    expect(screen.getByText("Seminar, Tuesday 3 November")).toBeTruthy();
    expect(screen.getByText("Moved from Mon 2 Nov, 11:20")).toBeTruthy();
    await press("Undo this week’s change");
    expect(remove).toHaveBeenCalledWith("overrides", "ov_p1_2026-11-02");
    await waitFor(() =>
      expect(screen.getByText("11:20 to 12:50")).toBeTruthy(),
    );
    expect(screen.queryByText(/Moved from/)).toBeNull();
  });

  it("validates the move form", async () => {
    await detail();
    await press("Move this week");
    await type("Start", "9am");
    await type("Date", "soon");
    expect(screen.getByText("Enter a time like 09:40.")).toBeTruthy();
    expect(screen.getByText("Enter a date like 2026-11-09.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save move" }).props.accessibilityState
        .disabled,
    ).toBe(true);
    await type("Start", "13:00");
    await type("End", "12:00");
    await type("Date", "2026-11-03");
    expect(
      screen.getByText("The class must end after it starts."),
    ).toBeTruthy();
  });

  it("cancels this week's class after confirming, then goes back", async () => {
    const { upsert } = await detail();
    await press("Cancel this week’s class");
    expect(
      screen.getByText("Cancel this class on Monday 2 November?"),
    ).toBeTruthy();
    await press("Keep it");
    expect(upsert).not.toHaveBeenCalled();
    await press("Cancel this week’s class");
    await press("Cancel class");
    expect(upsert).toHaveBeenCalledWith(
      "overrides",
      expect.objectContaining({ id: "ov_p1_2026-11-02", kind: "cancelled" }),
    );
    expect(router.back).toHaveBeenCalled();
  });

  it("changes every week from 2026-11-09 into two patterns", async () => {
    mockParams = { sessionId: "p1:2026-10-26" };
    const { upsert } = await setup(ClassScreen);
    await press("Change every week");
    expect(screen.getByLabelText("Starting from").props.value).toBe(
      "2026-10-26",
    );
    await type("Starting from", "2026-11-09");
    await type("Room", "050");
    await press("Save for every week");
    const patterns = upsert.mock.calls
      .filter((c) => c[0] === "patterns")
      .map((c) => c[1] as ClassPattern);
    expect(patterns).toHaveLength(2);
    expect(patterns[0]).toEqual(
      expect.objectContaining({ id: "p1", validTo: "2026-11-08" }),
    );
    expect(patterns[1]).toEqual(
      expect.objectContaining({
        room: "050",
        validFrom: "2026-11-09",
        validTo: null,
      }),
    );
    expect(patterns[1].id).not.toContain(":");
    expect(patterns[1].id).not.toBe("p1");
  });

  it("navigates to the new session after a change", async () => {
    await detail();
    await press("Change every week");
    await type("Room", "050");
    await press("Save for every week");
    const created = (await waitFor(() => {
      const call = (router.replace as jest.Mock).mock.calls[0];
      expect(call).toBeTruthy();
      return call[0];
    })) as { pathname: string; params: { sessionId: string } };
    expect(created.pathname).toBe("/class/[sessionId]");
    expect(created.params.sessionId).toMatch(/:2026-11-02$/);
  });

  describe("change warning", () => {
    const data = (): Partial<PlannerData> => ({
      ...base,
      overrides: [
        {
          id: "o1",
          sessionId: "p1:2026-11-16",
          kind: "cancelled",
          updatedAt: 1,
        },
      ],
      notes: [
        {
          id: "n1",
          text: "Bring laptop",
          subjectId: "tss",
          sessionId: "p1:2026-11-16",
          createdAt: 5,
          updatedAt: 1,
        },
      ],
    });

    it("warns with correct wording, and Go back saves nothing", async () => {
      const { upsert } = await detail(data());
      await press("Change every week");
      await type("Starting from", "2026-11-09");
      await press("Save for every week");
      expect(
        screen.getByText(
          "1 one-off change and 1 note on or after Mon 9 Nov won’t carry over to the new schedule. Your notes stay in Notes.",
        ),
      ).toBeTruthy();
      await press("Go back");
      expect(upsert).not.toHaveBeenCalled();
      expect(screen.queryByText(/won’t carry over/)).toBeNull();
    });

    it("Save anyway saves", async () => {
      const { upsert } = await detail(data());
      await press("Change every week");
      await type("Starting from", "2026-11-09");
      await press("Save for every week");
      await press("Save anyway");
      expect(upsert.mock.calls.filter((c) => c[0] === "patterns")).toHaveLength(
        2,
      );
    });

    it("pluralises and omits a zero part", async () => {
      await detail({
        ...base,
        notes: [
          {
            id: "n1",
            text: "a",
            subjectId: null,
            sessionId: "p1:2026-11-16",
            createdAt: 5,
            updatedAt: 1,
          },
          {
            id: "n2",
            text: "b",
            subjectId: null,
            sessionId: "p1:2026-11-23",
            createdAt: 6,
            updatedAt: 1,
          },
        ],
      });
      await press("Change every week");
      await type("Starting from", "2026-11-09");
      await press("Save for every week");
      expect(
        screen.getByText(
          "2 notes on or after Mon 9 Nov won’t carry over to the new schedule. Your notes stay in Notes.",
        ),
      ).toBeTruthy();
    });

    it("shows no warning when nothing is dropped", async () => {
      const { upsert } = await detail(data());
      await press("Change every week");
      await type("Starting from", "2026-11-23");
      await press("Save for every week");
      expect(screen.queryByText(/won’t carry over/)).toBeNull();
      expect(upsert.mock.calls.filter((c) => c[0] === "patterns")).toHaveLength(
        2,
      );
    });
  });

  it("shows the error when the change cannot be made", async () => {
    await detail({ ...base, patterns: [{ ...p1, validTo: "2026-11-02" }] });
    await press("Change every week");
    await type("Starting from", "2026-12-07");
    await press("Save for every week");
    expect(
      screen.getByText("Cannot change a class after it has ended."),
    ).toBeTruthy();
  });

  it("deletes the class after confirming", async () => {
    const { remove } = await detail();
    await press("Delete class");
    expect(
      screen.getByText(
        "This removes the class from every week, including past weeks. Your notes stay in Notes.",
      ),
    ).toBeTruthy();
    await press("Keep it");
    expect(remove).not.toHaveBeenCalled();
    await press("Delete class");
    await press("Delete class");
    expect(remove).toHaveBeenCalledWith("patterns", "p1");
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("lists links, homework and notes, and navigates to add screens", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue();
    const { upsert } = await detail({
      ...base,
      links: [
        {
          id: "l1",
          title: "Course page",
          url: "https://x.test",
          subjectId: "tss",
          updatedAt: 1,
        },
      ],
      homework: [
        {
          id: "h2",
          title: "Later",
          subjectId: "tss",
          due: "2026-11-20",
          dueTime: null,
          done: false,
          updatedAt: 1,
        },
        {
          id: "h1",
          title: "Sheet 3",
          subjectId: "tss",
          due: "2026-11-03",
          dueTime: null,
          done: false,
          updatedAt: 1,
        },
        {
          id: "h3",
          title: "Other",
          subjectId: "alg",
          due: "2026-11-04",
          dueTime: null,
          done: false,
          updatedAt: 1,
        },
      ],
      notes: [
        {
          id: "n1",
          text: "Old note",
          subjectId: "tss",
          sessionId: SID,
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "n2",
          text: "New note",
          subjectId: "tss",
          sessionId: SID,
          createdAt: 9,
          updatedAt: 1,
        },
      ],
    });
    await fireEvent.press(screen.getByRole("link", { name: "Course page" }));
    expect(open).toHaveBeenCalledWith("https://x.test");
    expect(screen.getByText("Sheet 3")).toBeTruthy();
    expect(screen.getByText("Later")).toBeTruthy();
    expect(screen.queryByText("Other")).toBeNull();
    expect(screen.getByText("Tomorrow")).toBeTruthy();
    expect(screen.getByText("New note")).toBeTruthy();
    const texts = screen
      .getAllByText(/^(New|Old) note$/)
      .map((n) => n.props.children);
    expect(texts).toEqual(["New note", "Old note"]);
    await fireEvent.press(screen.getByRole("checkbox", { name: "Sheet 3" }));
    expect(upsert).toHaveBeenCalledWith(
      "homework",
      expect.objectContaining({ id: "h1", done: true }),
    );
    await press("Add link");
    expect(router.push).toHaveBeenCalledWith("/link/edit?subjectId=tss");
    await press("Add homework");
    expect(router.push).toHaveBeenCalledWith("/homework/edit?subjectId=tss");
    await press("Add a note");
    expect(router.push).toHaveBeenCalledWith(
      "/note/edit?sessionId=p1%3A2026-11-02&subjectId=tss",
    );
    await press("All TSS notes");
    expect(router.push).toHaveBeenCalledWith("/notes?subjectId=tss");
  });

  it("handles an unknown session", async () => {
    mockParams = { sessionId: "nope:2026-11-02" };
    await setup(ClassScreen);
    expect(
      screen.getByText("This class is no longer in your timetable."),
    ).toBeTruthy();
    await press("Back to today");
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("treats a hidden subject's session as unknown", async () => {
    await detail({ ...base, subjects: [{ ...tss, attending: false }] });
    expect(
      screen.getByText("This class is no longer in your timetable."),
    ).toBeTruthy();
  });
});

describe("Add a class", () => {
  const addClass = (initial: Partial<PlannerData> = base) =>
    setup(EditClass, initial);

  it("creates a new subject and the pattern", async () => {
    const { upsert } = await addClass({ semester });
    expect(screen.getByText("Enter the subject’s name.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save class" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await type("Name", "Teoria Sistemelor");
    expect(screen.getByLabelText("Short name").props.value).toBe("TS");
    await type("Short name", "TSS");
    await choose("Seminar");
    await choose("Wed");
    await type("Start", "11:20");
    await type("End", "12:50");
    await type("Room", "048");
    await press("Save class");
    const subject = upsert.mock.calls.find(
      (c) => c[0] === "subjects",
    )![1] as Subject;
    expect(subject).toEqual(
      expect.objectContaining({
        name: "Teoria Sistemelor",
        abbreviation: "TSS",
        attending: true,
      }),
    );
    const pattern = upsert.mock.calls.find(
      (c) => c[0] === "patterns",
    )![1] as ClassPattern;
    expect(pattern).toEqual(
      expect.objectContaining({
        subjectId: subject.id,
        type: "seminar",
        weekday: 3,
        start: "11:20",
        end: "12:50",
        room: "048",
        repeat: "every",
        validFrom: "2026-09-28",
        validTo: null,
        online: false,
      }),
    );
    expect(pattern.id).not.toContain(":");
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("uses an existing subject and today when there is no semester", async () => {
    const { upsert } = await addClass({ subjects: [tss] });
    expect(screen.getByText("Choose a subject.")).toBeTruthy();
    await choose("Teoria Sistemelor");
    expect(screen.queryByText("Choose a subject.")).toBeNull();
    await press("Save class");
    expect(upsert.mock.calls.some((c) => c[0] === "subjects")).toBe(false);
    const pattern = upsert.mock.calls.find(
      (c) => c[0] === "patterns",
    )![1] as ClassPattern;
    expect(pattern.subjectId).toBe("tss");
    expect(pattern.validFrom).toBe("2026-11-02");
  });

  it("shows validation messages and hides Room when online", async () => {
    await addClass();
    await choose("Teoria Sistemelor");
    await type("Start", "9");
    expect(screen.getByText("Enter a time like 09:40.")).toBeTruthy();
    await type("Start", "10:00");
    await type("End", "09:00");
    expect(
      screen.getByText("The class must end after it starts."),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Save class" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await fireEvent(screen.getByLabelText("Online"), "valueChange", true);
    expect(screen.queryByLabelText("Room")).toBeNull();
  });
});
