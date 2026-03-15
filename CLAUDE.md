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

## Data Source

Data from Rebrickable (rebrickable.com). "You can use these files for any purpose."
LEGO is a trademark of the LEGO Group. Not produced by or endorsed by the LEGO Group.

## Engineering

Uses Superpowers for engineering execution. Follow TDD workflow: write tests first, then implement.
