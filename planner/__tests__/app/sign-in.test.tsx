import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import SignIn from "../../app/sign-in";
import { useAuth } from "../../src/data/auth";

jest.mock("../../src/data/auth", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;

function auth(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    loading: false,
    configError: null,
    signIn: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn(),
    ...overrides,
  };
}

describe("sign-in screen", () => {
  it("shows the heading and one button that signs in", async () => {
    const a = auth();
    mockUseAuth.mockReturnValue(a);
    await render(<SignIn />);
    expect(screen.getByText("Your timetable, on every device")).toBeTruthy();
    expect(
      screen.getByText(
        "Sign in to keep your classes, homework and notes in sync on your phone, iPad and laptop.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await fireEvent.press(screen.getByText("Sign in with Google"));
    expect(a.signIn).toHaveBeenCalledTimes(1);
  });

  it("shows an error when sign-in rejects", async () => {
    mockUseAuth.mockReturnValue(
      auth({ signIn: jest.fn().mockRejectedValue(new Error("nope")) }),
    );
    await render(<SignIn />);
    expect(screen.queryByText("Sign-in didn’t finish. Try again.")).toBeNull();
    await fireEvent.press(screen.getByText("Sign in with Google"));
    expect(
      await screen.findByText("Sign-in didn’t finish. Try again."),
    ).toBeTruthy();
  });

  it("shows the configuration error instead of the button", async () => {
    mockUseAuth.mockReturnValue(
      auth({ configError: "Firebase is not configured. Copy it." }),
    );
    await render(<SignIn />);
    expect(
      screen.getByText("Firebase is not configured. Copy it."),
    ).toBeTruthy();
    expect(screen.queryByText("Sign in with Google")).toBeNull();
  });
});
