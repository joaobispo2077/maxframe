import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the foundation message", () => {
    render(<App />);

    expect(
      screen.getByText("Paste your URL below and check the Quality available"),
    ).toBeInTheDocument();
  });
});
