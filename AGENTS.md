# Repository Guidance

## Definition of Done
Before reporting any change complete, run all of these and confirm they pass:
```bash
npm run typecheck
npm test
npm run build
```
Report actual results, not expectations. If any command fails, report the failure
output verbatim and do not claim success. Do not skip a check because the change
"looks safe". These scripts are defined in `package.json`; if a script is missing
or renamed, stop and report that instead of substituting your own command.

## Project Shape
- TypeScript MCP server (stdio transport) for code-search-api, the local semantic
  code search service at `http://localhost:5204`. Published to npm as
  `@solomonneas/code-search-mcp`, also loadable as an OpenClaw plugin.
- Two entry points that must stay in sync: `src/index.ts` (MCP stdio server, built
  to `dist/index.js` by tsup) and `index.mjs` (OpenClaw plugin, plain JS, duplicates
  the client and tool logic).
- Tools are registered in `src/tools/code-search.ts`: `search_code`, `list_projects`,
  `code_search_stats`, `health`. HTTP client in `src/client.ts` hits only
  `POST /api/search` and `GET /api/projects`, `/api/stats`, `/api/summary-stats`, `/health`.
- Config in `src/config.ts`: `CODE_SEARCH_API_URL` (default `http://localhost:5204`),
  optional `CODE_SEARCH_API_KEY` sent as `X-API-Key`.

## Hard Prohibitions
- Never call `DELETE /api/index` or any state-changing endpoint on the live service
  on 5204. It wipes the index and its LLM summaries, which are expensive to rebuild.
  This applies during development, tests, smoke runs, debugging, and reviews.
  The server is read-only by design: never add tools that index, delete, backfill,
  or mutate.
- Never run `scripts/release.sh --publish` unless the user explicitly asks for a
  release in this session. It publishes to npm and ClawHub.
- Never push with `--no-verify`. `hooks/pre-push` runs a content-guard scan against
  `~/repos/content-guard/policies/public-repo.json`. If it blocks, fix the leak or
  add an inline `<!-- content-guard: allow <rule-id> -->` tag, then push normally.
- Never weaken, comment out, or skip a failing check to get to green. Report the
  exact blocker and stop instead of working around it.

## Rules
- Changing a tool, schema, or client behavior in `src/`: mirror the change in
  `index.mjs` in the same commit. If you find only one entry point changed, stop
  and update the other before doing anything else.
- Touching transport setup in `src/index.ts`: keep the `transport.send` intercept
  that strips the draft-07 `$schema` key from `tools/list` output. Some MCP clients
  reject draft-07 schemas. If the intercept blocks your change, report why instead
  of removing it.
- Cutting a release: bump both the hardcoded `VERSION` constant in `src/index.ts`
  and `package.json` `version`. They are separate; a mismatch ships silently.
- Running `npm run smoke`: it needs a live code-search-api on 5204 and spawns the
  built `dist/index.js`, so run `npm run build` first. If the service is down,
  report that; do not mark smoke as passed.
- Changing the publish payload: run `npm run pack:dry-run` and confirm it contains
  exactly `dist`, `index.mjs`, `openclaw.plugin.json`, `README.md`, `LICENSE`.
- Editing `index.mjs` config handling: it accepts `url`, `apiKey`, `apiKeyEnv` in
  addition to env vars and validates the URL is http or https. Keep that validation.
- `prepublishOnly` runs typecheck, tests, and build. A broken test blocks
  `npm publish`; fix the test, do not bypass the hook.

## Memory Handoff
At the end of any substantial task, write a handoff note to
`.claude/memory-handoffs/` using that directory's `TEMPLATE.md`. Record durable
discoveries, gotchas, and decisions. Do not wait to be reminded.
