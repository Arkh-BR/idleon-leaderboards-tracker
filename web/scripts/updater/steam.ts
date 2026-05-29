// ===== Idleon updater — Steam changelog =====
// Pulls the official patch notes from Steam's public News API (no auth).
// app 1476970 = "Legends of Idleon MMO".

export const STEAM_APPID = 1476970;

export type SteamNews = {
  title: string;
  url: string;
  date: number; // unix seconds
  dateISO: string;
  contents: string;
};

/** Fetches the latest `count` news items, newest first. */
export async function fetchSteamNews(count = 8): Promise<SteamNews[]> {
  const url =
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/` +
    `?appid=${STEAM_APPID}&count=${count}&maxlength=0&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam News API failed: HTTP ${res.status}`);
  const json = (await res.json()) as {
    appnews?: { newsitems?: Array<{ title: string; url: string; date: number; contents: string }> };
  };
  const items = json.appnews?.newsitems ?? [];
  return items.map((n) => ({
    title: n.title,
    url: n.url,
    date: n.date,
    dateISO: new Date(n.date * 1000).toISOString().slice(0, 10),
    contents: n.contents,
  }));
}

/** Only the items newer than `sinceUnix` (0 → all). */
export function newsSince(news: SteamNews[], sinceUnix: number): SteamNews[] {
  return news.filter((n) => n.date > sinceUnix);
}
