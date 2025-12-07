# ai-tao

Setup and maintain AI assistant configuration files for your projects with opinionated best practices.

Supports multiple AI coding assistants:
- **Claude Code** (`CLAUDE.md` / `CLAUDE.local.md`)
- **Cursor** (`.cursorrules`)
- **Windsurf** (`.windsurfrules`)
- **GitHub Copilot** (`.github/copilot-instructions.md`)

## Installation

```bash
# Using bunx (no installation required)
bunx ai-tao

# Using npx
npx ai-tao
```

## Usage

```bash
# Run interactive setup (first time) or update existing files
bunx ai-tao
```

On first run, you'll be prompted to:
1. Select which AI tools to configure
2. Choose between shared (committed) or local (gitignored) files
3. Select frameworks/tools your project uses (flavors)

On subsequent runs, ai-tao automatically detects and updates existing configuration files.

## Available Flavors

| Flavor | Description |
|--------|-------------|
| `nextjs` | Next.js App Router conventions, Server Components, Server Actions, routing patterns |

More flavors coming soon! Contributions welcome.

## What it does

1. **Detects** existing AI-TAO managed files in your project
2. **Prompts** for tool selection, local/shared preference, and flavors (on first run)
3. **Fetches** the latest template from the [ai-tao repository](https://github.com/ftzi/ai-tao)
4. **Creates or updates** configuration files for selected AI tools
5. **Adds framework-specific guidance** based on selected flavors
6. **Preserves** any custom content you've added outside the managed section
7. **Adds to .gitignore** (local mode only)

## Managed Section

The template content is wrapped in markers:

```markdown
<!-- AI-TAO:START -->
... template content from GitHub ...
<!-- AI-TAO:END -->
```

You can add your own project-specific content **outside** these markers, and it will be preserved when you update:

```markdown
# My Project-Specific Notes

Custom content here is preserved!

<!-- AI-TAO:START -->
... auto-managed template ...
<!-- AI-TAO:END -->

## More Custom Content

This is also preserved!
```

## Local vs Shared Mode

When setting up for the first time, you choose between:

- **Shared mode**: Files are committed to git (team-wide configuration)
- **Local mode**: Files are added to `.gitignore` (personal preferences)

For Claude Code, local mode uses `CLAUDE.local.md` instead of `CLAUDE.md`.
For other tools, the same file is used but added to `.gitignore`.

## Supported Tools

| Tool | Shared File | Local File |
|------|-------------|------------|
| Claude Code | `CLAUDE.md` | `CLAUDE.local.md` |
| Cursor | `.cursorrules` | `.cursorrules` (gitignored) |
| Windsurf | `.windsurfrules` | `.windsurfrules` (gitignored) |
| GitHub Copilot | `.github/copilot-instructions.md` | `.github/copilot-instructions.md` (gitignored) |

## Contributing Flavors

To add a new flavor:

1. Create a new file in `templates/flavors/<flavor-name>.md`
2. Add the flavor name to `AVAILABLE_FLAVORS` in `src/ai-tao.ts`
3. Submit a PR!

## License

MIT
