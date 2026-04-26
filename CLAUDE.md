# lego-oracle

MCP server for LEGO data: sets, parts, colours, inventories, minifigures, themes, MOCs, part relationships.

## Stack Profiles

- MCP stack profile: `../../stacks/mcp/`
- TypeScript stack profile: `../../stacks/typescript/`

Read both stack profiles before writing any code.

## Architecture

- **Embedded data**: Rebrickable CSVs ingested into SQLite at build time
- **Does NOT fetch at runtime**: all data bundled in the npm package
- **Updates**: Daily GitHub Actions sync fetches fresh CSVs, rebuilds, auto-publishes if changed
- **Storage**: SQLite with FTS5 for search

## Build behavior

`npm run build` auto-runs `npm run fetch-data` if `src/data/lego.sqlite` is missing. This means a clean clone (e.g. Glama's auto-rebuild container) can run `npm install && npm run build` and produce a working package without manual steps. The cached SQLite in `src/data/` (gitignored, ~109 MB) is reused on subsequent builds — no redundant fetches.

The SQLite is **not** tracked in git. Rebrickable's terms forbid automated download by individual end-users (`"Under no circumstances are you allowed to use automation tools to download data..."`), so we cannot ship a runtime-fetch model. The current pattern — single CI machine fetches once daily, redistributes via npm — is the compliant architecture.

## Data Source

Data from Rebrickable (rebrickable.com). "You can use these files for any purpose."
LEGO is a trademark of the LEGO Group. Not produced by or endorsed by the LEGO Group.

## Engineering

Uses Superpowers for engineering execution. Follow TDD workflow: write tests first, then implement.
