// Local receiver for capturing a signed-in save from the site (see ../README.md §1).
// The site tab navigates to http://127.0.0.1:8767/#<gzip+base64 bundle>; this page POSTs the
// hash back to itself and the server writes <outDir>/bundle.json, then exits.
// usage: node scripts/dr-debug/capture/receiver.mjs <outDir> [port]
import http from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [outDir, port = "8767"] = process.argv.slice(2);
if (!outDir) throw new Error("usage: receiver.mjs <outDir> [port]");
mkdirSync(outDir, { recursive: true });
const page = `<!doctype html><meta charset="utf-8"><title>save receiver</title><body>receiving…<script>
(async () => {
  const h = location.hash.slice(1);
  if (!h) { document.body.textContent = 'no hash'; return; }
  const r = await fetch('/save', { method: 'POST', body: h });
  document.body.textContent = 'saved ' + h.length + ' (' + r.status + ')';
  history.replaceState(null, '', '/');
})();
</script>`;
http.createServer((req, res) => {
  if (req.method === "GET") { res.writeHead(200, { "content-type": "text/html" }); return res.end(page); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const b64 = decodeURIComponent(body).replace(/-/g, "+").replace(/_/g, "/");
    const json = gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
    writeFileSync(`${outDir}/bundle.json`, json);
    console.log("wrote", `${outDir}/bundle.json`, json.length);
    res.writeHead(200); res.end("ok");
    setTimeout(() => process.exit(0), 300);
  });
}).listen(Number(port), "127.0.0.1", () => console.log(`listening 127.0.0.1:${port}`));
setTimeout(() => process.exit(0), 15 * 60 * 1000);
