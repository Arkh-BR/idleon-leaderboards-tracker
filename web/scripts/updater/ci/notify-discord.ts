// Posts an update-watch summary to a Discord channel webhook (DISCORD_WEBHOOK_URL).
// Used by CI (the MCP Discord bot is only available inside a Claude session).
//   npx tsx scripts/updater/ci/notify-discord.ts "<prUrl>" "<status>" "<sha12>"
// status: "clean" (build+tests+golden green) | "needs-human" (something failed)

export function buildDiscordMessage(prUrl: string, status: string, sha12: string): string {
  const head =
    status === "clean"
      ? "🟢 **Idleon update detectado** — mecânico aplicado e validado."
      : "🟠 **Idleon update detectado** — precisa de revisão humana (fórmulas a portar / validação falhou).";
  return [
    head,
    `• N.js \`${sha12}\``,
    `• PR (draft, não-mergeado): ${prUrl}`,
    status === "clean"
      ? "• Próximo passo: revisar o diff e mergear."
      : "• Próximo passo: rodar o Claude no PR para portar as fórmulas sinalizadas (ver runbook), até o golden ficar verde.",
  ].join("\n");
}

async function main(): Promise<void> {
  const [prUrl = "", status = "needs-human", sha12 = "?"] = process.argv.slice(2);
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.warn("[notify] DISCORD_WEBHOOK_URL ausente — pulando notificação.");
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: buildDiscordMessage(prUrl, status, sha12) }),
  });
  if (!res.ok) {
    console.error(`[notify] Discord webhook HTTP ${res.status}`);
    process.exit(1);
  }
  console.log("[notify] Discord notificado.");
}

main().catch((e) => {
  console.error("[notify] ERRO:", (e as Error).message);
  process.exit(1);
});
