// Snippets to paste with the browser's javascript_tool on the signed-in site tab (see ../README.md §1).
// Not executed by node. Never read or send the session token.

// (A) Before clicking "Sync now": keep a copy of every Firebase response the site fetches.
if (!window.__origFetch) {
  window.__origFetch = window.fetch;
  window.__caps = [];
  window.fetch = async (...a) => {
    const r = await window.__origFetch(...a);
    try {
      const u = String(a[0]?.url ?? a[0]);
      if (/firestore|firebaseio/.test(u)) window.__caps.push({ u: u.replace(/auth=[^&]+/, "auth=X"), t: await r.clone().text() });
    } catch {}
    return r;
  };
}

// (B) After the sync: bundle the raw bodies, gzip + base64url, and hand them to receiver.mjs.
const pick = { data: /documents\/_data\//, uid: /\/_uid\//, comp: /\/_comp\//, vars: /_vars\/_vars/, guild: /\/_guild\//, tres: /_T_RES_UID/, tour: /_TOURNAMENT\/_TOURNAMENT/, usgu: /\/_usgu\// };
const bundle = {};
for (const [n, re] of Object.entries(pick)) bundle[n] = [...window.__caps].reverse().find((c) => re.test(c.u))?.t ?? null;
const gz = new Uint8Array(await new Response(new Blob([new TextEncoder().encode(JSON.stringify(bundle))]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
let s = "";
for (let i = 0; i < gz.length; i += 0x8000) s += String.fromCharCode.apply(null, gz.subarray(i, i + 0x8000));
location.href = "http://127.0.0.1:8767/#" + btoa(s).replace(/\+/g, "-").replace(/\//g, "_");
