/** Haxe `Std.string` of a value the game concatenates to "": null (and undefined) print as "null". */
export const hString = (v: unknown): string => (v == null ? "null" : String(v));
