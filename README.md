<!-- mcp-name: io.github.gregario/lego-oracle -->
<p align="center">
  <h1 align="center">LEGO Oracle</h1>
  <p align="center">LEGO sets, parts, minifigs, and inventories. An MCP server.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/lego-oracle"><img src="https://img.shields.io/npm/v/lego-oracle.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/lego-oracle"><img src="https://img.shields.io/npm/dm/lego-oracle.svg" alt="npm downloads"></a>
  <a href="https://github.com/gregario/lego-oracle/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT Licence"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node.js 18+"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-compatible-purple.svg" alt="MCP Compatible"></a>
</p>

---

Ask your AI assistant about LEGO sets, find specific bricks, look up minifigures, browse themes, and compare sets. All backed by Rebrickable's catalog (26k sets, 62k parts, 17k minifigs), not hallucinations.

**10 tools. Zero config. Works with every MCP-compatible IDE.**

## Install

```bash
npx -y lego-oracle
```

### Add to your IDE

<details open>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add lego-oracle -- npx -y lego-oracle
```
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):
```json
{
  "mcpServers": {
    "lego-oracle": {
      "command": "npx",
      "args": ["-y", "lego-oracle"]
    }
  }
}
```
</details>

<details>
<summary><strong>Cursor</strong></summary>

Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "lego-oracle": {
      "command": "npx",
      "args": ["-y", "lego-oracle"]
    }
  }
}
```
</details>

<details>
<summary><strong>VS Code (Copilot)</strong></summary>

Add to `.vscode/mcp.json`:
```json
{
  "servers": {
    "lego-oracle": {
      "command": "npx",
      "args": ["-y", "lego-oracle"]
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "lego-oracle": {
      "command": "npx",
      "args": ["-y", "lego-oracle"]
    }
  }
}
```
</details>

<details>
<summary><strong>Zed</strong></summary>

Add to `settings.json`:
```json
{
  "context_servers": {
    "lego-oracle": {
      "command": {
        "path": "npx",
        "args": ["-y", "lego-oracle"]
      }
    }
  }
}
```
</details>

## Tools

### Set Tools

| Tool | Description |
|------|-------------|
| `search_sets` | Search for sets by name, theme, year, or piece count. Full-text search with filters. |
| `get_set` | Get complete set details: inventory (grouped by part category), minifigures, theme hierarchy. |
| `compare_sets` | Compare 2-4 sets side by side: piece count, year, theme, minifigs, shared parts. |

### Part Tools

| Tool | Description |
|------|-------------|
| `search_parts` | Search parts by name, category, colour, or material. |
| `get_part` | Get part details including available colours and mold/print variants. |
| `find_part_in_sets` | Find which sets contain a specific part (optionally in a specific colour), sorted by quantity. |

### Minifig Tools

| Tool | Description |
|------|-------------|
| `search_minifigs` | Search minifigures by name. |
| `get_minifig` | Get minifig details and every set it appears in. |

### Discovery Tools

| Tool | Description |
|------|-------------|
| `browse_themes` | Browse the LEGO theme hierarchy. Top-level themes or drill into sub-themes with set counts. |
| `find_mocs` | Find community alternate builds (MOCs) for a set's parts. |

## Data

All data is embedded at build time from Rebrickable. No network calls at runtime.

| Category | Count |
|----------|-------|
| Sets | 26,339 |
| Parts | 61,702 |
| Colours | 275 |
| Minifigures | 16,646 |
| Inventory entries | 1,483,652 |
| Part relationships | 35,757 |
| Themes | 490 |

Data is updated daily via GitHub Actions. New npm versions are published automatically when Rebrickable data changes.

## Development

```bash
npm install
npm run build
npm test             # 141 tests
```

To refresh data from Rebrickable:

```bash
npm run fetch-data
npm run build
```

## Attribution

Data from [Rebrickable](https://rebrickable.com). LEGO is a trademark of the LEGO Group. This project is not produced by or endorsed by the LEGO Group.

## License

MIT
