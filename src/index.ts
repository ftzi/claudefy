#!/usr/bin/env node

import { aiTao, TOOL_CONFIG } from "./ai-tao.js";

const args = process.argv.slice(2);

const showHelp = args.includes("-h") || args.includes("--help");

if (showHelp) {
  console.log(`
ai-tao - Setup and maintain AI assistant configuration files

Supports: Claude Code, Cursor, Windsurf, GitHub Copilot

Usage:
  bunx ai-tao
  npx ai-tao

Options:
  -h, --help     Show this help message

Description:
  This tool creates or updates AI assistant configuration files with
  a template fetched from the official ai-tao repository.

  On first run, you'll be prompted to:
    1. Select which AI tools to configure
    2. Choose shared (committed) or local (gitignored) files
    3. Select frameworks/tools your project uses (flavors)

  Supported tools:
    - Claude Code: CLAUDE.md / CLAUDE.local.md
    - Cursor: .cursorrules
    - Windsurf: .windsurfrules
    - GitHub Copilot: .github/copilot-instructions.md

  The managed section is marked with:
    <!-- AI-TAO:START -->
    ... template content ...
    <!-- AI-TAO:END -->

  Any content outside these markers will be preserved when updating.

Examples:
  bunx ai-tao    # Interactive setup or update
`);
  process.exit(0);
}

aiTao()
  .then((result) => {
    console.log("");
    for (const file of result.files) {
      const action = file.created ? "Created" : "Updated";
      const toolName = TOOL_CONFIG[file.tool].name;
      console.log(`${action} ${file.filename} (${toolName})`);
    }
    if (result.flavorsAdded.length > 0) {
      console.log(`Flavors: ${result.flavorsAdded.join(", ")}`);
    }
    if (result.gitignoreUpdated) {
      console.log(`Added files to .gitignore`);
    }
  })
  .catch((error: Error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
