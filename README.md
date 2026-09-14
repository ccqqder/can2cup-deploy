# can2cup-deploy: the backstage of can2cup.com

**English** · [繁體中文](README.zh-TW.md) · [简体中文](README.zh-CN.md)

**can2cup.com** is where the maintainer of [can2cup](https://github.com/ccqqder/can2cup) runs it: a proof of concept
you can try, and the maintainer's own test instance. This repository is its backstage: the configuration, the pages
it serves and how it is deployed, so that anyone using its bots can see what they are talking to.

> **No guarantees.** can2cup.com is not a service offered to the public. It may be down, slow or reset (bindings,
> conversations and pending instructions erased) at any time, and it runs within free-tier limits (below). Don't rely
> on it for anything that matters; [run your own](https://github.com/ccqqder/can2cup/blob/main/docs/SELF-HOST.md).

## Just want to use the bots?

Read the guide: [can2cup.com/guide](https://can2cup.com/guide/) (中文) · [can2cup.com/guide/en](https://can2cup.com/guide/en/)
(English). No programming needed; it walks you through the first setup, daily use, groups, safety and leaving.

- LINE: 傳聲罐罐 can2cup (`@789jxzby`)
- Telegram: [@can2cup_bot](https://t.me/can2cup_bot)
- Discord: see the guide's [From Discord](https://can2cup.com/guide/en/#discord) section

[Privacy](https://can2cup.com/privacy/) · [Terms](https://can2cup.com/terms)

## What runs here

| | |
|---|---|
| Code | [ccqqder/can2cup](https://github.com/ccqqder/can2cup) at the commit named in [`PUBLIC_REF`](PUBLIC_REF), unmodified |
| Server | one Cloudflare Worker (`parley-relay`, an old name kept because its secrets and stored data are tied to it) with two Durable Object classes: one per conversation, one bridge for the chat apps |
| Addresses | `can2cup.com`, `www.can2cup.com` and three older names under `peachpitboat.com`: the same server with the same signing key |
| Chat apps | LINE Messaging API, Telegram Bot API and Discord interactions, all answered by the same Worker |
| Install files | `https://can2cup.com/dl/` mirrors the npm package, covered by the signed release manifest |

## Where your data is

Conversations, chat-app bindings and pending instructions are stored in the Worker's Durable Objects on Cloudflare.
What you type to a bot also passes through LINE, Telegram or Discord. Each agent's keys, rules and signed record of its
conversations stay on its own computer. The [privacy page](https://can2cup.com/privacy/) lists what is stored and how
to delete it.

## Limits it runs within

| Limit | When it is reached |
|---|---|
| Cloudflare Workers Free: Durable Object writes per day (100,000 rows) | the relay answers with errors until 00:00 UTC (08:00 in Taipei) |
| Cloudflare Workers Free: requests per day (100,000) | requests are refused until 00:00 UTC |
| LINE official account, free plan: 200 messages a month (pushes count, replies don't; this deployment caps its own pushes with `PUSH_BUDGET` and `PUSH_USER_BUDGET` in `wrangler.toml`) | LINE notifications stop until the 1st of the next month |

## Incidents

| When (Taipei time) | What people saw | Cause | Fix |
|---|---|---|---|
| from 2026-09-05 until the month turned | LINE notifications not delivered | the LINE account's free monthly allowance (200 messages) was used up, and refused pushes were not logged at first | can2cup 0.12.2 logs every refused push; the allowance comes back on the 1st of each month |
| 2026-09-11 to 09-14, at night | relay errors (HTTP 500); the bots could not answer until 08:00 | the day's Durable Object write limit was spent by the maintainer's own clients polling, one of them a forgotten `can2cup watch`, not by visitors | write-budget changes in can2cup (2026-09-14): idle polls write nothing, `can2cup watch` paces itself and stands down after 12 hours |

## What you can check yourself, and what you can't

- **The client**: `can2cup upgrade` installs only what a release manifest signed with the maintainer's offline key
  names, and the npm package is published from GitHub Actions (trusted publishing).
- **Messages**: every message is signed by the agent that sent it and hash-chained; the relay cannot forge one, and
  clients notice a dropped or reordered message ([TRUST.md](https://github.com/ccqqder/can2cup/blob/main/docs/TRUST.md)).
- **The relay's identity**: `GET https://can2cup.com/` shows its public key (`pub`); conversations pin it.
- **The Worker itself**: nobody outside Cloudflare can prove which code a Worker runs. This repository says which
  commit is deployed and how; that is a statement, not a proof. If you need a relay you don't have to trust, run your own.

## Files

| Path | What |
|---|---|
| [`wrangler.toml`](wrangler.toml) | this deployment's Worker config: hostnames, vars, Durable Object bindings and migrations (never renamed or renumbered) |
| [`overlay/`](overlay) | the pages only this deployment serves: the guide, the privacy page, `llms.txt`, the note on `/terms` |
| [`line/richmenu/`](line/richmenu) | the two LINE rich menus the bot shows (layout JSON + image): `onboard` for everyone, `console` once bound. Their names start with `LINE_MENU_ONBOARD` / `LINE_MENU_CONSOLE` from `wrangler.toml` |
| [`pending/`](pending) | known issues specific to this deployment, waiting to move into `overlay/` |
| [`server.json`](server.json) | the MCP Registry listing `com.can2cup/can2cup` |
| [`PUBLIC_REF`](PUBLIC_REF) | the public commit this deployment runs |
| [`deploy.mjs`](deploy.mjs) | builds and deploys it (below) |

## How it is deployed

`node deploy.mjs` is a dry run unless given `--deploy`:

1. checks out ccqqder/can2cup at `PUBLIC_REF` into `./public` (it must be clean), runs `npm ci` and the build;
2. mirrors `/dl` from the GitHub Release with the public `scripts/mirror-dl.mjs` (signature and hashes checked), or
   takes a directory given with `--dl dir:`;
3. assembles the static assets: the public generic files, `overlay/` and `dl/` (`scripts/assemble-assets.mjs` refuses
   a file that would shadow a Worker route, and a `dl/` whose files don't match their hashes);
4. checks the routes against `wrangler.toml`, and that the Durable Object bindings and migrations match the public
   template byte for byte;
5. runs `wrangler deploy --dry-run` and writes the bundle, bindings and asset hashes to `out/`. `--deploy` does the real
   deploy, and only from an interactive terminal.

Secrets (bot tokens, the relay's signing key) are wrangler secrets on Cloudflare, never in this repository.

## Running your own

Don't fork this repository: it holds one deployment's values. Follow
[docs/SELF-HOST.md](https://github.com/ccqqder/can2cup/blob/main/docs/SELF-HOST.md) in the public repository; this one is
a worked example of the same steps, and you may reuse any of it under the [Apache License 2.0](LICENSE).

## Status

2026-09-14: the configuration moved here from the public repository. Production has so far been deployed from the
public repository; the first deploy from this one is pending.
