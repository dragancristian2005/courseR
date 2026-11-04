import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import Backup from "../../app/settings/backup";
import { createMemoryRepository } from "../../src/data/memoryRepository";
import { StoreProvider } from "../../src/data/StoreProvider";
import { downloadText, pickTextFile } from "../../src/data/backupFile";
import { exportBackup, parseBackup } from "../../src/domain/backup";
import { emptyPlannerData } from "../../src/data/repository";
import { todayISO } from "../../src/domain/dates";

jest.mock("../../src/data/backupFile", () => ({
  downloadText: jest.fn(),
  pickTextFile: jest.fn(),
}));

const mockDownload = downloadText as jest.Mock;
const mockPick = pickTextFile as jest.Mock;

const subject = {
  id: "s1",
  name: "Algebra",
  abbreviation: "ALG",
  attending: true,
  updatedAt: 5,
};

async function setup() {
  const repo = createMemoryRepository({ subjects: [subject] });
  const replaceAll = jest.spyOn(repo, "replaceAll");
  await render(
    <StoreProvider repository={repo}>
      <Backup />
    </StoreProvider>,
  );
  return { repo, replaceAll };
}

beforeEach(() => jest.clearAllMocks());

describe("backup screen", () => {
  it("shows title, body and both buttons", async () => {
    await setup();
    expect(screen.getByText("Backup")).toBeTruthy();
    expect(
      screen.getByText(
        "Download a copy of everything in your account, or restore one you saved earlier.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Download backup")).toBeTruthy();
    expect(screen.getByText("Restore from backup")).toBeTruthy();
  });

  it("downloads a dated file that parses back to the store data", async () => {
    await setup();
    await fireEvent.press(screen.getByText("Download backup"));
    expect(mockDownload).toHaveBeenCalledTimes(1);
    const [filename, text] = mockDownload.mock.calls[0];
    expect(filename).toBe(`study-planner-backup-${todayISO()}.json`);
    const parsed = parseBackup(text);
    expect(parsed).toEqual({
      ok: true,
      data: { ...emptyPlannerData(), subjects: [subject] },
    });
  });

  it("shows the error for a bad file and does not replace", async () => {
    mockPick.mockResolvedValue("{nope");
    const { replaceAll } = await setup();
    await fireEvent.press(screen.getByText("Restore from backup"));
    expect(
      await screen.findByText("This file could not be read."),
    ).toBeTruthy();
    expect(screen.queryByText("Replace everything")).toBeNull();
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is cancelled", async () => {
    mockPick.mockResolvedValue(null);
    const { replaceAll } = await setup();
    await fireEvent.press(screen.getByText("Restore from backup"));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(screen.queryByText("Replace everything")).toBeNull();
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it("shows an error when the picker throws", async () => {
    mockPick.mockRejectedValue(
      new Error("Backups on this device arrive with the native app."),
    );
    await setup();
    await fireEvent.press(screen.getByText("Restore from backup"));
    expect(
      await screen.findByText(
        "Backups on this device arrive with the native app.",
      ),
    ).toBeTruthy();
  });

  it("cancel leaves everything alone", async () => {
    mockPick.mockResolvedValue(exportBackup(emptyPlannerData(), new Date()));
    const { replaceAll } = await setup();
    await fireEvent.press(screen.getByText("Restore from backup"));
    expect(
      await screen.findByText(
        "This replaces everything in your account with the backup. Continue?",
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Cancel"));
    expect(screen.queryByText("Replace everything")).toBeNull();
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it("replaces everything after confirmation", async () => {
    const data = {
      ...emptyPlannerData(),
      subjects: [{ ...subject, id: "s2", name: "Logic" }],
    };
    mockPick.mockResolvedValue(exportBackup(data, new Date()));
    const { replaceAll } = await setup();
    await fireEvent.press(screen.getByText("Restore from backup"));
    await fireEvent.press(await screen.findByText("Replace everything"));
    await waitFor(() => expect(replaceAll).toHaveBeenCalledWith(data));
    expect(await screen.findByText("Backup restored.")).toBeTruthy();
    expect(screen.queryByText("Replace everything")).toBeNull();
  });
});

describe("backup screen before data has loaded", () => {
  it("disables both buttons while loading", async () => {
    const repo = createMemoryRepository();
    repo.subscribe = () => () => {};
    const replaceAll = jest.spyOn(repo, "replaceAll");
    await render(
      <StoreProvider repository={repo}>
        <Backup />
      </StoreProvider>,
    );
    expect(screen.getByText("Loading your data…")).toBeTruthy();
    await fireEvent.press(screen.getByText("Download backup"));
    await fireEvent.press(screen.getByText("Restore from backup"));
    expect(
      screen.getByRole("button", { name: "Download backup" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Restore from backup" }),
    ).toBeDisabled();
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockPick).not.toHaveBeenCalled();
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it("disables both buttons when the data failed to load", async () => {
    const repo = createMemoryRepository();
    repo.subscribe = (_cb, onError) => {
      onError?.(new Error("offline"));
      return () => {};
    };
    await render(
      <StoreProvider repository={repo}>
        <Backup />
      </StoreProvider>,
    );
    expect(
      screen.getByText("Backups need your data to load first."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Download backup"));
    expect(
      screen.getByRole("button", { name: "Download backup" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Restore from backup" }),
    ).toBeDisabled();
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
