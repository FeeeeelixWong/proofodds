import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../src/App";

describe("resolution workbench", () => {
  it("shows the market proposal and receipt workflow", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    render(<App />);
    expect(screen.getByText("What should this market settle to?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify and resolve/i })).toBeInTheDocument();
    expect(screen.getByText("Settlement receipt")).toBeInTheDocument();
  });
});
