import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/protest/config", () => ({ PROTEST_MODE: true }));

import TopNav from "@/components/TopNav";

describe("TopNav during protest mode", () => {
  it("renders nothing so the tools can't be reached from the nav", () => {
    const { container } = render(<TopNav />);
    expect(container.querySelector("nav")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
