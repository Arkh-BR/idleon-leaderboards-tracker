// Core conventions of lib/game: how a refusal is raised (state.ts), how a DNSM cache is shaped (njs/DNSM.ts) and how a NotPorted
// sub-case is spelled (errors.ts). The rest of the suite pins behaviour; this pins the shape of the code itself.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildGameState, type GameEnvelope } from "@/lib/game/state";
import { MissingSaveKey } from "@/lib/game/errors";

const GAME = join(__dirname, "../../../lib/game");

describe("a refusal is raised at build", () => {
  it("buildGameState throws on a save the load steps cannot replay: there is no half-valid state", () => {
    const env = {
      data: { CSver: 33.05, DoOnceREAL: 100 }, charNames: [], companion: null, guildData: {}, serverVars: null, tournament: {},
      accountCreateTime: 0, lastUpdated: 0,
    } as unknown as GameEnvelope;
    expect(() => buildGameState(env)).toThrow(MissingSaveKey);
  });
});

describe("DNSM.ts documents its convention", () => {
  it("the header says when a cache is a per-key block and when it may return a Map", () => {
    const head = readFileSync(join(GAME, "njs/DNSM.ts"), "utf8").split("\nimport ")[0];
    expect(head).toMatch(/DNSM convention/);
    expect(head).toMatch(/per-key[\s/]+`block\("DNSM\.<Name>"/);
    expect(head).toMatch(/returns the Map/);
  });
});

describe("every NotPorted sub-case follows one format", () => {
  // "<Sub>", "<Sub>:<arg>=<value>[,<arg>=<value>]", "<arg>=<value>", "<state>=<value>". A template literal is checked with its `${}` as 0.
  const SUB = /^([A-Za-z_][\w]*(:[a-z]\w*=[^,]+(,[a-z]\w*=[^,]+)*)?|[A-Za-z]\w*=[^,]+)$/;
  const files = readdirSync(join(GAME, "njs")).map((f) => join(GAME, "njs", f));
  const sites: { file: string; arg: string }[] = [];
  for (const file of files) {
    for (const m of readFileSync(file, "utf8").matchAll(/new NotPorted\(\s*"[^"]+",\s*([^;]*)\)\s*;/g)) sites.push({ file, arg: m[1] });
  }
  it("finds the call sites", () => expect(sites.length).toBeGreaterThan(40));
  it("a literal sub is spelled by the format; a variable sub is the switch's named sub-case", () => {
    for (const { file, arg } of sites) {
      const lit = arg.match(/^(?:"([^"]*)"|`([^`]*)`)$/);
      if (!lit) {
        expect(arg, file).toMatch(/^[bd]$/); // `default:` of a switch on the sub-case name, or the d of a named block
        continue;
      }
      const text = (lit[1] ?? lit[2]).replace(/\$\{[^}]*\}/g, "0");
      expect(text, `${file}: ${arg}`).toMatch(SUB);
    }
  });
});
