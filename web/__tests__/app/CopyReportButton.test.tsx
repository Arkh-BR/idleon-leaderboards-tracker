// web/__tests__/app/CopyReportButton.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CopyReportButton from "@/app/protest/CopyReportButton";
import { PROTEST } from "@/lib/protest/config";

describe("CopyReportButton", () => {
  it("copies the report text and shows feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    // happy-dom has no clipboard by default — provide one.
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyReportButton />);
    fireEvent.click(screen.getByRole("button"));

    expect(writeText).toHaveBeenCalledWith(PROTEST.reportText);
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });
});
