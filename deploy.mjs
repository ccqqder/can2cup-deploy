#!/usr/bin/env node
/**
 * can2cup.com deploy — the public code at a pinned commit, this repo's config and pages, nothing else.
 *
 *   node deploy.mjs                     dry-run: build everything, write the bundle + an asset listing to out/<time>/
 *   node deploy.mjs --deploy            the real deploy (interactive terminal only)
 *   node deploy.mjs wrangler <args…>    any wrangler command against this deployment (secret list, tail, rollback …)
 *
 * Options
 *   --public-repo <path|url>   where to fetch the pinned commit from (default: $CAN2CUP_PUBLIC_REPO, else PUBLIC_REF.repo)
 *   --dl release               /dl mirrored from the GitHub Release of that version (default)
 *   --dl relay:<url>           /dl mirrored from a running relay (verified the same way)
 *   --dl dir:<path>            /dl taken as-is from a directory (e.g. a public checkout's staged relay-assets/dl)
 *   --outdir <dir>             dry-run output directory
 *
 * Steps: public/ is a clone checked out at PUBLIC_REF.sha (verified, clean) → npm ci when the lockfile changed → build →
 * /dl mirrored and signature-checked by the public mirror-dl script → assets assembled from the public generic files +
 * overlay/ → routes-check on this wrangler.toml → the DO bindings and migrations must match the public template
 * byte for byte → wrangler with --config wrangler.toml.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, "public");
const CONFIG = join(HERE, "wrangler.toml");
const BUILD = join(HERE, "build");
const WRANGLER = join(PUB, "node_modules", "wrangler", "bin", "wrangler.js");

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  return v !== undefined && !v.startsWith("--") ? v : true;
};
const die = (msg) => { console.error(`deploy: ${msg}`); process.exit(1); };
const run = (cmd, argv, opts = {}) => {
  console.error(`$ ${cmd === process.execPath ? "node" : cmd} ${argv.map((a) => relative(HERE, a) && !relative(HERE, a).startsWith("..") && a.includes(HERE) ? relative(HERE, a) : a).join(" ")}`);
  const r = spawnSync(cmd, argv, { stdio: "inherit", ...opts });
  if (r.error) die(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) die(`${cmd} ${argv[0] ?? ""} exited ${r.status ?? r.signal}`);
};
const capture = (cmd, argv, opts = {}) => {
  const r = spawnSync(cmd, argv, { encoding: "utf8", ...opts });
  if (r.error) die(`${cmd}: ${r.error.message}`);
  return { code: r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
};
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
// npm through node itself: on Windows npm is a .cmd, and spawning that needs a shell that does not escape arguments.
const NPM_CLI = [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), process.env.npm_execpath].find((p) => p && existsSync(p));
const npm = (argv) => (NPM_CLI
  ? run(process.execPath, [NPM_CLI, ...argv], { cwd: PUB })
  : run("npm", argv, { cwd: PUB }));

function listing(dir) {
  const rows = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else rows.push(`${sha256(readFileSync(p))}  ${relative(dir, p).split("\\").join("/")}`);
    }
  };
  walk(dir);
  return rows.join("\n") + "\n";
}

/** The [[durable_objects.bindings]] and [[migrations]] tables, comments and spacing normalised. */
function doTables(toml) {
  const tables = [];
  let cur = null;
  for (const raw of toml.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").replace(/^#.*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("[")) {
      cur = /^\[\[(durable_objects\.bindings|migrations)\]\]$/.test(line) ? [line] : null;
      if (cur) tables.push(cur);
      continue;
    }
    if (cur) cur.push(line.replace(/\s*=\s*/, " = "));
  }
  return tables.map((t) => t.join("\n")).join("\n\n");
}

// ---- 1. the pinned public checkout --------------------------------------------------------------------------------
const ref = JSON.parse(readFileSync(join(HERE, "PUBLIC_REF"), "utf8"));
if (!/^[0-9a-f]{40}$/.test(ref.sha ?? "")) die("PUBLIC_REF: sha must be a full 40-hex commit id");
const source = typeof flag("public-repo") === "string" ? flag("public-repo") : process.env.CAN2CUP_PUBLIC_REPO || ref.repo;
if (!source) die("no public repo to fetch from (--public-repo, $CAN2CUP_PUBLIC_REPO or PUBLIC_REF.repo)");

if (args[0] !== "wrangler") {
  if (!existsSync(join(PUB, ".git"))) run("git", ["clone", "--no-checkout", "--quiet", source, PUB]);
  if (capture("git", ["-C", PUB, "cat-file", "-e", `${ref.sha}^{commit}`]).code !== 0) {
    run("git", ["-C", PUB, "fetch", "--quiet", "--tags", source, "+refs/heads/*:refs/remotes/source/*"]);
  }
  run("git", ["-C", PUB, "-c", "advice.detachedHead=false", "checkout", "--quiet", "--detach", ref.sha]);
  if (capture("git", ["-C", PUB, "rev-parse", "HEAD"]).out !== ref.sha) die("public/ is not at PUBLIC_REF");
  const dirty = capture("git", ["-C", PUB, "status", "--porcelain", "--untracked-files=no"]).out;
  if (dirty) die(`public/ has local changes:\n${dirty}`);
  console.error(`deploy: public/ at ${ref.sha.slice(0, 12)}${ref.tag ? ` (${ref.tag})` : ""}`);

  // ---- 2. dependencies and build ----------------------------------------------------------------------------------
  const lockHash = sha256(readFileSync(join(PUB, "package-lock.json")));
  const marker = join(PUB, "node_modules", ".deploy-lock-sha256");
  if (!existsSync(marker) || readFileSync(marker, "utf8").trim() !== lockHash) {
    npm(["ci", "--no-audit", "--no-fund"]);
    writeFileSync(marker, `${lockHash}\n`);
  }
  npm(["run", "build"]);
} else if (!existsSync(WRANGLER)) {
  die("public/ is not prepared yet — run `node deploy.mjs` (a dry-run) once first");
}

// ---- passthrough: wrangler against this deployment ----------------------------------------------------------------
if (args[0] === "wrangler") {
  run(process.execPath, [WRANGLER, ...args.slice(1), "--config", CONFIG], { cwd: HERE });
  process.exit(0);
}

// ---- 3. /dl and the assets directory -------------------------------------------------------------------------------
const version = JSON.parse(readFileSync(join(PUB, "package.json"), "utf8")).version;
rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });
const dlOpt = typeof flag("dl") === "string" ? flag("dl") : "release";
let dlDir = join(BUILD, "dl");
const mirror = join(PUB, "scripts", "mirror-dl.mjs");
if (dlOpt === "release") run(process.execPath, [mirror, "--version", version, "--out", dlDir, "--from-release", "ccqqder/can2cup"], { cwd: PUB });
else if (dlOpt.startsWith("relay:")) run(process.execPath, [mirror, "--version", version, "--out", dlDir, "--from-relay", dlOpt.slice("relay:".length)], { cwd: PUB });
else if (dlOpt.startsWith("dir:")) { dlDir = resolve(dlOpt.slice("dir:".length)); if (!existsSync(join(dlDir, "manifest.json"))) die(`--dl dir: ${dlDir} has no manifest.json`); }
else die(`--dl ${dlOpt}: expected release, relay:<url> or dir:<path>`);

const ASSETS = join(BUILD, "assets");
run(process.execPath, [join(PUB, "scripts", "assemble-assets.mjs"), "--out", ASSETS, "--overlay", join(HERE, "overlay"), "--dl", dlDir], { cwd: PUB });

// ---- 4. config checks ------------------------------------------------------------------------------------------------
run(process.execPath, [join(PUB, "scripts", "routes-check.mjs"), "--config", CONFIG], { cwd: PUB });
const mine = readFileSync(CONFIG, "utf8");
const template = readFileSync(join(PUB, "wrangler.toml"), "utf8");
if (!/^name\s*=\s*"parley-relay"\s*$/m.test(mine)) die('wrangler.toml: name must stay "parley-relay" (secrets, DO namespaces and the workers.dev name are keyed to it)');
if (!/^workers_dev\s*=\s*true\s*$/m.test(mine)) die("wrangler.toml: workers_dev = true must stay (invite links use the workers.dev name)");
if (doTables(mine) !== doTables(template)) die("wrangler.toml: [[durable_objects.bindings]] / [[migrations]] differ from the public template — a DO rename or migration must land in the public repo first");

// ---- 5. wrangler ---------------------------------------------------------------------------------------------------
if (flag("deploy")) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) die("--deploy runs only from an interactive terminal: non-interactive wrangler takes over custom domains attached elsewhere without asking");
  run(process.execPath, [WRANGLER, "deploy", "--config", CONFIG], { cwd: HERE });
} else {
  const outdir = typeof flag("outdir") === "string" ? resolve(flag("outdir")) : join(HERE, "out", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(outdir, { recursive: true });
  const r = capture(process.execPath, [WRANGLER, "deploy", "--dry-run", "--outdir", join(outdir, "bundle"), "--config", CONFIG], { cwd: HERE });
  writeFileSync(join(outdir, "dry-run.txt"), `${r.out}\n${r.err}\n`);
  writeFileSync(join(outdir, "assets.sha256"), listing(ASSETS));
  writeFileSync(join(outdir, "PUBLIC_REF"), `${ref.sha}\n`);
  process.stderr.write(`${r.out}\n${r.err}\n`);
  if (r.code !== 0) die(`wrangler dry-run exited ${r.code}`);
  console.error(`deploy: dry-run written to ${outdir}`);
}
