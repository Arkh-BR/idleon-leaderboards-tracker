import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Num from "@/components/Num";

describe("Num", () => {
  it("renders the suffix in its own highlighted span", () => {
    const { container } = render(<Num value={17114049124784.227} plus />);
    const root = container.firstElementChild as HTMLElement;
    const suffixEl = root.querySelector("span");
    expect(suffixEl?.textContent).toBe("T");
    expect(suffixEl).toHaveClass("text-[1.15em]");
  });

  it("the whole element's textContent is the full formatted string", () => {
    const { container } = render(<Num value={17114049124784.227} plus />);
    expect(container.firstElementChild?.textContent).toBe("+17.114T");
  });

  it("appends the unit after the suffix", () => {
    const { container } = render(<Num value={171140496624.184} unit="x" />);
    expect(container.firstElementChild?.textContent).toBe("171.140Bx");
  });

  it("defaults the title to the full value", () => {
    const { container } = render(<Num value={171140496624.184} unit="x" />);
    expect(container.firstElementChild).toHaveAttribute(
      "title",
      "171140496624.184"
    );
  });

  it("uses a provided title instead of the default", () => {
    const { container } = render(<Num value={5} title="custom tooltip" />);
    expect(container.firstElementChild).toHaveAttribute(
      "title",
      "custom tooltip"
    );
  });

  it("title={false} opts out of the default title entirely", () => {
    const { container } = render(<Num value={5} title={false} />);
    expect(container.firstElementChild).not.toHaveAttribute("title");
  });

  it("applies the passed className to the root element", () => {
    const { container } = render(
      <Num value={5} className="text-emerald-300" />
    );
    expect(container.firstElementChild).toHaveClass("text-emerald-300");
  });

  it("renders an em dash for non-finite values", () => {
    const { container } = render(<Num value={NaN} />);
    expect(container.textContent).toBe("—");
  });
});
