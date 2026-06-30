import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BiggestGains from "@/components/dropRate/BiggestGains";

const P = (sys: string) => `Drop Rate / Post-Processing / ${sys}`;

/** A reference loader stub that ignores classKey and returns a fixed map. */
const refLoader = (ref: Record<string, number>) => async () => ref;

describe("BiggestGains — states", () => {
  it("Empty: no save → prompts to load one", () => {
    render(
      <BiggestGains
        yoursFlat={null}
        classKey={null}
        loadReference={refLoader({})}
      />
    );
    expect(
      screen.getByText("Load a save above to see your biggest Drop Rate gains.")
    ).toBeInTheDocument();
  });

  it("Anonymous: shows the AnonExcludedNote, not a silent empty table", () => {
    render(
      <BiggestGains
        yoursFlat={{ [P("🎽 Equipment")]: 2 }}
        classKey={null}
        anonymous
        loadReference={refLoader({ [P("🎽 Equipment")]: 3 })}
      />
    );
    expect(
      screen.getByText(/Anonymous players are excluded/i)
    ).toBeInTheDocument();
  });

  it("Compute error: shows the reused error banner without crashing", () => {
    render(
      <BiggestGains
        yoursFlat={{ [P("🎽 Equipment")]: 2 }}
        classKey={null}
        computeError="Drop rate compute failed: bad save"
        loadReference={refLoader({ [P("🎽 Equipment")]: 3 })}
      />
    );
    expect(
      screen.getByText(/Drop rate compute failed: bad save/)
    ).toBeInTheDocument();
  });

  it("At ceiling: every system already at/above max → congrats state", async () => {
    render(
      <BiggestGains
        yoursFlat={{ [P("🎽 Equipment")]: 3 }}
        classKey={null}
        loadReference={refLoader({ [P("🎽 Equipment")]: 3 })}
      />
    );
    expect(
      await screen.findByText(/at or above the Observed Max on every system/i)
    ).toBeInTheDocument();
  });

  it("Success: hero card names the biggest win and the table ranks systems", async () => {
    render(
      <BiggestGains
        yoursFlat={{ [P("🎽 Equipment")]: 2 }}
        classKey={null}
        loadReference={refLoader({ [P("🎽 Equipment")]: 3 })}
      />
    );
    // Hero card — names the top system with the rounded gain. The full
    // sentence spans several text nodes, so assert the hero container text.
    const heroStrong = await screen.findByText("Biggest win →");
    expect(heroStrong.parentElement?.textContent).toContain(
      "improve 🎽 Equipment for +50% Drop Rate"
    );
    // "biggest win" badge on the top row (distinct from the hero strong)
    expect(screen.getByText("biggest win")).toBeInTheDocument();
    // Table headers (English, exact)
    for (const h of ["System", "Type", "You", "Observed Max", "DR gain"]) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
    // Multiplier type badge + the table's DR-gain cell (one decimal place)
    expect(screen.getByText("Multiplier")).toBeInTheDocument();
    expect(screen.getByText("+50.0%")).toBeInTheDocument();
    // The system is named in both the hero and the ranked table row
    expect(screen.getAllByText("🎽 Equipment")).toHaveLength(2);
  });
});
