# can2cup-deploy (private)

The configuration of **can2cup.com**, the maintainer's own proof-of-concept relay and test instance. The code lives in
the public repo [ccqqder/can2cup](https://github.com/ccqqder/can2cup); this repo holds only what belongs to this one
deployment, so that the public repo stays deployable by anyone who forks it.

| path | what |
|---|---|
| `wrangler.toml` | Worker `parley-relay`: the five hostnames, vars, DO bindings and migrations (never rename or renumber) |
| `overlay/` | this deployment's static pages: guide, privacy, `llms.txt`, the `/terms` operator note, instance known issues |
| `server.json` | the MCP Registry listing for `com.can2cup/can2cup` (its proof is the `MCP_REGISTRY_AUTH` var) |
| `PUBLIC_REF` | the public tag + commit this deployment runs (to be added with `deploy.mjs`) |

Status: skeleton (2026-09-14). Production still deploys from the public repo until `deploy.mjs` exists and a dry-run
matches the last in-repo deploy byte for byte (bundle, bindings, assets).
