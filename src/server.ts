#!/usr/bin/env node

/**
 * lego-oracle MCP Server
 *
 * Exposes 10 LEGO tools over the Model Context Protocol (stdio transport).
 * Data is embedded from Rebrickable CSV downloads at build time.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getDatabase } from './data/db.js';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Tool schemas and handlers
import { SearchSetsInput, handler as searchSetsHandler } from './tools/search-sets.js';
import { GetSetInput, handler as getSetHandler } from './tools/get-set.js';
import { SearchPartsInput, handler as searchPartsHandler } from './tools/search-parts.js';
import { GetPartInput, handler as getPartHandler } from './tools/get-part.js';
import { FindPartInSetsInput, handler as findPartInSetsHandler } from './tools/find-part-in-sets.js';
import { SearchMinifigsInput, handler as searchMinifigsHandler } from './tools/search-minifigs.js';
import { GetMinifigInput, handler as getMinifigHandler } from './tools/get-minifig.js';
import { BrowseThemesInput, handler as browseThemesHandler } from './tools/browse-themes.js';
import { FindMocsInput, handler as findMocsHandler } from './tools/find-mocs.js';
import { CompareSetsInput, handler as compareSetsHandler } from './tools/compare-sets.js';

// Response formatters
import {
  formatSearchSets,
  formatGetSet,
  formatSearchParts,
  formatGetPart,
  formatFindPartInSets,
  formatSearchMinifigs,
  formatGetMinifig,
} from './format.js';
import { formatBrowseThemes } from './tools/browse-themes.js';
import { formatFindMocs } from './tools/find-mocs.js';
import { formatCompareSets } from './tools/compare-sets.js';

// --- Version ---

function getVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

// --- Main ---

async function main(): Promise<void> {
  const version = getVersion();

  // Open embedded SQLite database
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dbPath = path.join(__dirname, 'data', 'lego.sqlite');
  const db = getDatabase(dbPath);

  // Create MCP server
  const server = new McpServer(
    { name: 'lego-oracle', version },
    { capabilities: { tools: {} } },
  );

  // --- Set Tools ---

  server.tool(
    'search_sets',
    'Search for LEGO sets by name, theme, year, or piece count. Use this when looking for sets matching specific criteria. Returns a summary list: use get_set for full details on a specific set.',
    SearchSetsInput.shape,
    async (params) => {
      try {
        const result = searchSetsHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatSearchSets(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error searching sets: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    'get_set',
    'Get complete details for a specific LEGO set including piece inventory, minifigures, and theme. Use this when you know a set number (like 75192-1) or set name and need full information. Returns inventory grouped by part category.',
    GetSetInput.shape,
    async (params) => {
      try {
        const result = getSetHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatGetSet(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error getting set: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  // --- Part Tools ---

  server.tool(
    'search_parts',
    'Search for LEGO parts by name, category, colour, or material. Use this when looking for specific brick types, plates, tiles, or other elements. Returns part numbers and names: use get_part for full details.',
    SearchPartsInput.shape,
    async (params) => {
      try {
        const result = searchPartsHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatSearchParts(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error searching parts: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    'get_part',
    'Get complete details for a specific LEGO part including available colours and mold/print variants. Use this when you know a part number (like 3001) and need its specifications, colour availability, or related parts.',
    GetPartInput.shape,
    async (params) => {
      try {
        const result = getPartHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatGetPart(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error getting part: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    'find_part_in_sets',
    'Find which LEGO sets contain a specific part, optionally in a specific colour. Use this when a builder wants to know where to source a particular brick. Results sorted by quantity (most pieces first).',
    FindPartInSetsInput.shape,
    async (params) => {
      try {
        const result = findPartInSetsHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatFindPartInSets(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error finding part in sets: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  // --- Minifig Tools ---

  server.tool(
    'search_minifigs',
    'Search for LEGO minifigures by name. Use this when looking for specific characters or minifig types. Returns fig numbers and names: use get_minifig for full details and set appearances.',
    SearchMinifigsInput.shape,
    async (params) => {
      try {
        const result = searchMinifigsHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatSearchMinifigs(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error searching minifigs: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    'get_minifig',
    'Get complete details for a specific LEGO minifigure including every set it appears in. Use this when you know a minifig name or fig number and want to find which sets include it.',
    GetMinifigInput.shape,
    async (params) => {
      try {
        const result = getMinifigHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatGetMinifig(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error getting minifig: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  // --- Theme & Discovery Tools ---

  server.tool(
    'browse_themes',
    'Browse the LEGO theme hierarchy. With no input, returns all top-level themes with set counts. With a theme name, returns its sub-themes and sets. Use this to explore what LEGO themes exist or drill into a specific theme.',
    BrowseThemesInput.shape,
    async (params) => {
      try {
        const result = browseThemesHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatBrowseThemes(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error browsing themes: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    'find_mocs',
    'Find community alternate builds (MOCs) that can be made from a specific LEGO set\'s parts. Use this when someone wants to know what else they can build with parts they already own.',
    FindMocsInput.shape,
    async (params) => {
      try {
        const result = findMocsHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatFindMocs(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error finding MOCs: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  server.tool(
    'compare_sets',
    'Compare 2 to 4 LEGO sets side by side. Shows piece count, year, theme, minifig count, and shared parts between sets. Use this when someone is deciding between sets or wants to know what parts overlap.',
    CompareSetsInput.shape,
    async (params) => {
      try {
        const result = compareSetsHandler(db, params);
        return { content: [{ type: 'text' as const, text: formatCompareSets(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error comparing sets: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    },
  );

  // --- Connect transport and start ---

  const transport = new StdioServerTransport();
  console.error(`[lego-oracle] v${version} starting on stdio...`);
  await server.connect(transport);
  console.error(`[lego-oracle] Server running: 10 tools registered`);
}

main().catch((err) => {
  console.error(`[lego-oracle] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
