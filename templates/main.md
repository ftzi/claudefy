

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Important:** If you discover any information in this file that is no longer accurate or has become outdated, please update it immediately to reflect the current state of the codebase.

**Workflow Rule:** Always run `bun ok` after finishing a task or when facing issues. This command runs type checking and linting across the entire codebase and must fully pass before considering a task complete.

**No Manual Tests:** Never include manual verification tasks in Livespec plans or task lists. All validation must be automated (`bun ok`, automated tests, etc.). Manual browser testing, viewport testing, and similar human-required verification steps are forbidden.

**NEVER commit or push:** Do NOT run `git add`, `git commit`, or `git push`. The user handles all git operations manually.

**When starting work on a Next.js project, ALWAYS call the `init` tool from next-devtools-mcp FIRST to set up proper context and establish documentation requirements. Do this automatically without being asked.**

## Maintaining This File

Update CLAUDE.md when you make changes that affect:

- **Architecture & Structure**: Monorepo organization, new workspaces, routing patterns, data flow
- **Development Workflow**: New commands, build process changes, testing setup
- **Key Patterns & Conventions**: File organization, API patterns
- **Tool & Library Migrations**: Package manager changes, major dependency updates, framework migrations
- **Configuration Changes**: TypeScript, Biome, or build tool configurations that affect how developers work

Do NOT update for:

- Individual bug fixes or routine component additions
- Code-level details that can be read from files
- Temporary workarounds or one-off solutions
- Generic best practices unrelated to this specific project

Keep entries brief and structural. Focus on "why" and "how the pieces fit together", not "what's in each file".

## Project Overview

Nextbook is a zero-config component stories library for Next.js. This monorepo contains:

- **packages/nextbook** - The main library (publishable as `nextbook` on npm)
- **apps/web** - Marketing website for nextbook.dev (also includes nextbook `/ui` stories and Playwright tests)

**AI-Ready Design:** Nextbook is designed to be AI-friendly. The simple, predictable API (`story()` function + Zod schemas) makes it easy for AI assistants to generate stories for components instantly. When working with users, AI can quickly scaffold comprehensive stories with interactive controls - no complex configuration needed.

## Common Commands

### Type Checking, Linting & Testing

- `bun ts` - Type check all workspaces with TypeScript
- `bun lint` - Format and lint with Biome across all workspaces
- `bun test` - Run unit tests (nextbook package)
- `bun ok` - Run ts, lint, and test (quick verification)
- `bun e2e` - Run Playwright visual regression tests (starts dev server automatically)
- `bun build` - Build all apps and packages

**IMPORTANT: Never run `bun dev` or `next dev` directly.** The dev server causes lock file issues and port conflicts. Instead:
- For e2e tests: Use `bun e2e` which starts the dev server automatically via Playwright's webServer config
- For manual testing: Ask the user to run the dev server themselves

## Architecture

### Monorepo Structure

This is a Turborepo monorepo with two main workspace types:

- **apps/** - Application projects
  - **web/** - Marketing website for nextbook.dev (includes `/ui` stories and Playwright tests)

- **packages/** - Shared packages
  - **nextbook/** - The main nextbook library
  - **typescript-config/** - Shared TypeScript configurations

### Package Management

- Uses **Bun 1.3.3** as package manager (defined in package.json)
- Workspace catalog manages shared dependencies (React 19.2.0, TypeScript 5.9.3, Zod 4.1.12, Next.js 16.0.1)
- All internal packages use `workspace:*` protocol for dependencies

### Nextbook Package (packages/nextbook/)

**Purpose:** Zero-config, zero-dependency component stories for Next.js

**Zero Dependencies Architecture:**

The nextbook package has **zero runtime dependencies**. This is a key differentiator from Storybook (100+ deps) and prevents version conflicts, security vulnerabilities from transitive deps, and bloated node_modules.

- **No icon library** - Icons are inline SVGs in `src/components/icons/icons.tsx`
- **No CLI framework** - Uses native `process.argv` parsing
- **No virtualization library** - Custom `useVirtualizer` hook in `src/utils/use-virtualizer.ts`
- **Peer dependencies only** - `next`, `react`, `react-dom`, `zod` (required), `msw` (optional)

When adding features, **never add runtime dependencies**. Implement functionality inline or use peer dependencies that users already have.

**Key Files:**

- `src/index.ts` - Public exports (createStories, NextbookShell, StoryPage, story)
- `src/registry.tsx` - createStories implementation (nested loaders → flat loaders)
- `src/story.ts` - story() function and isStory() type guard
- `src/components/` - React components (NextbookShell, Sidebar, StoryViewer, ControlsPanel)
- `src/cli/` - CLI tool for scaffolding (bunx nextbook init)
- `src/utils/schema.ts` - Zod schema introspection (supports both Zod 3 and 4)

**Server/Client Boundary:**

- `stories/index.ts` must have `"use client"` - loaders are functions that can't cross server→client boundary
- `NextbookShell` is a client component - receives the stories object
- User's layout.tsx (Server Component) must render `<html>` and `<body>` tags

**Lazy Loading Strategy:**

Stories are loaded on-demand, NOT at initialization:

1. `createStories()` - Only parses file paths to build tree structure. NO modules loaded.
2. Sidebar expansion - When a story file node is expanded, exports are loaded to show variants.
3. Story viewing - When navigating to a story, the module is loaded to render it.

**Styling Architecture:**

- **CSS Modules** - All component styles use `.module.css` files for complete isolation
- **No Tailwind dependency** - Works regardless of user's CSS setup (Tailwind, vanilla, Sass, etc.)
- **CSS Custom Properties** - Design tokens defined in `styles/tokens.css` for consistent theming
- **Dark mode** - Automatic via `prefers-color-scheme` media query
- **User-proof** - Scoped class names prevent style conflicts with user's application

**UI Design Philosophy:**

The nextbook UI should be **polished**, **modern**, and **professional**:

- **MUST be mobile-friendly** - Every web page MUST be fully responsive and work perfectly on mobile devices. This is non-negotiable.

- Clean, minimal interface with purposeful whitespace
- Subtle glassmorphism and depth effects
- Smooth micro-interactions and transitions
- Professional color palette with excellent contrast
- Polished details that delight users
- **Use Tooltips liberally** - Add tooltips to icons, buttons, and controls to help developers discover functionality and maximize usability. The `Tooltip` component has a 200ms delay before showing.

**Matrix Viewer (Virtualization):**

The matrix viewer (`storyMatrix()`) displays all prop combinations in a grid. Key implementation details:

- **Virtualized rendering** - Custom `useVirtualizer` hook (`src/utils/use-virtualizer.ts`) renders only visible rows
- **Cell measurement** - Starts with default dimensions (220x140), measures actual first cell after render
- **Full render mode** - Add `?fullRender=true` to URL to render all cells (for Playwright screenshots)
- **Accessible cells** - Uses `<div role="button" tabIndex={0}>` instead of `<button>` to avoid nested button HTML errors when story content contains buttons

**File Structure:**

```
packages/nextbook/src/
├── cli/                    # CLI tool (bunx nextbook init)
│   ├── index.ts           # CLI entry point (native process.argv)
│   ├── init.ts            # Init logic
│   ├── init.test.ts       # CLI tests
│   └── templates.ts       # File templates (MUST match current API!)
├── components/
│   ├── controls-panel.tsx      # Zod-generated controls UI
│   ├── controls-panel.module.css
│   ├── matrix-viewer.tsx       # Virtualized matrix grid (storyMatrix)
│   ├── matrix-viewer.module.css
│   ├── nextbook-shell.tsx      # Main shell (client component)
│   ├── nextbook-shell.module.css
│   ├── sidebar.tsx             # Navigation sidebar (client component)
│   ├── sidebar.module.css
│   ├── story-page.tsx          # Story rendering with error boundary
│   ├── story-viewer.tsx        # Individual story viewer
│   └── story-viewer.module.css
├── styles/
│   └── tokens.css         # CSS custom properties (design tokens)
├── utils/
│   ├── schema.ts          # Zod schema introspection
│   ├── schema.test.ts     # Unit tests for schema utilities
│   └── use-virtualizer.ts # Custom virtualization hook (zero-dep)
├── index.ts               # Public exports
├── registry.tsx           # createStories implementation
├── story.ts               # story() function and isStory()
└── types.ts               # TypeScript types
```

**Common Pitfalls:**

1. **Forgetting "use client" on stories/index.ts** - Loaders contain functions that can't cross server→client boundary
2. **Adding html/body in the nextbook layout** - Next.js layouts nest; the root layout already provides these tags. The `/ui` layout should only contain `<NextbookShell>`.
3. **Making createStories async** - It was async before but caused boundary issues; now synchronous
4. **CLI templates out of sync** - `src/cli/templates.ts` MUST match current API when making changes

### Marketing Website (apps/web/)

**Purpose:** Public-facing marketing website at nextbook.dev + nextbook `/ui` stories for testing

**Tech Stack:**

- Next.js 16 with React 19 and React Compiler
- Tailwind CSS 4 with shadcn/ui components
- Framer Motion for animations
- Vercel Analytics for usage tracking
- Playwright for e2e testing
- MSW for API mocking in stories

**Key Features:**

- Landing page with hero, features, code demo, comparison, quick start, and CTA sections
- Dynamic OG images using Next.js ImageResponse API
- SEO infrastructure (sitemap.ts, robots.ts)
- Responsive design with dark mode default
- Nextbook stories at `/ui` demonstrating component library
- Playwright visual regression tests in `tests/`

**File Structure:**

```
apps/web/
├── app/
│   ├── layout.tsx           # Root layout (Geist fonts, metadata, Analytics)
│   ├── page.tsx             # Landing page
│   ├── globals.css          # Tailwind CSS 4 + design tokens
│   ├── ui/                  # Nextbook stories UI
│   │   ├── layout.tsx       # Nextbook shell wrapper
│   │   ├── [[...path]]/     # Dynamic story routes
│   │   └── stories/         # Story definitions
│   └── ...                  # OG images, sitemap, robots
├── components/
│   ├── landing/             # Landing page sections (hero, features, etc.)
│   ├── shared/              # Header, footer, logo, container, section
│   ├── ui/                  # shadcn/ui components (button, badge, card)
│   └── demo/                # Demo components for stories (e.g., UserCard)
├── e2e/                     # Playwright e2e tests
│   ├── sidebar.e2e.ts       # Sidebar navigation tests
│   ├── story-viewer.e2e.ts  # Story viewer tests
│   ├── controls-panel.e2e.ts # Controls panel tests
│   ├── mocking.e2e.ts       # MSW mocking tests
│   ├── matrix.e2e.ts        # Matrix story tests
│   └── marketing-screenshots.e2e.ts # Marketing screenshots
├── playwright.config.ts     # Playwright configuration
└── public/images/           # Logo assets
```

**Design Philosophy:**

- Uses Tailwind CSS (unlike the nextbook package which uses CSS Modules)
- This is intentional: the marketing site can use any styling, while the package must work in any user's setup
- Brand colors match the logo gradient: cyan (#06B6D4) → purple (#7C3AED) → pink (#EC4899)

**Screenshot Placeholders:**

The website includes placeholder areas for screenshots that need to be captured:
- `hero-screenshot.png` (1200x800) - Full nextbook UI
- `feature-zod-controls.png` (600x400) - Controls panel demo
- `feature-story-matrix.png` (800x500) - Matrix view
- `code-demo-preview.png` (800x600) - Code + preview
- `quickstart-terminal.png` (700x200) - CLI command

### Linting & Code Quality

- **Biome** - Code formatting and linting (TypeScript, React, accessibility)
  - Comprehensive rules for correctness, complexity, and suspicious patterns
  - React-specific rules: hooks at top level, exhaustive dependencies
  - Accessibility (a11y) rules enabled
  - All unsafe fixes require explicit `--unsafe` flag

### TypeScript Configuration

- Shared configs in `packages/typescript-config/` with strict mode
- Uses `"moduleResolution": "bundler"` - Optimized for Next.js and Bun
- Module format: `"module": "ESNext"` for modern JavaScript features
- Incremental compilation enabled for faster builds

### Turborepo Configuration

- Tasks configured in `turbo.json` with dependency chains for build, lint, and type checking

## Code Quality Standards

**Development Workflow:**

- **ALWAYS use `bun ok`** for type checking and linting - never use `bun ts`, `bun lint`, or `tsc` directly
- **NEVER run `tsc` directly** - not even for single files - always use `bun ok`
- **NEVER run `bun build` or `bun run build`** - only use `bun ok` for verification
- **CRITICAL: `bun ok` MUST ALWAYS be run from the project root directory**
  - NEVER run it from subdirectories like `apps/example` or `packages/*`
  - Always navigate to the root first: `cd /Users/ftzi/dev/nextbook && bun ok`
  - This is a Turborepo monorepo - the command must run from root to check all packages
- `bun ok` runs both type checking and linting, leverages Turbo cache, and is always preferred
- NEVER commit or push code - all git operations must be explicitly requested by the user

**Code Principles:** Follow Clean Code + SOLID + KISS + YAGNI

- **Clean Code**: Self-documenting, readable code with meaningful names and single responsibility
- **SOLID**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **KISS**: Simplest solution that solves the problem, avoid over-engineering
- **YAGNI**: Don't add functionality until actually needed

**TypeScript Conventions:**

- **NEVER use `any` type** - Use `unknown` if type is truly unknown, but even that should be avoided
- **NEVER use `as any` assertions** - Find the proper type or use specific type assertions
- **NEVER use `interface`** - Always use `type` instead
- Reuse existing types - don't create duplicate types
- Use Zod schemas for runtime validation when appropriate
- Prefer optional chaining for callbacks: `onComplete?.(data)` instead of `if (onComplete) onComplete(data)`

**Import Conventions:**

- **NEVER use barrel files** - Barrel files (index.ts files that re-export everything) are forbidden
  - Exception: `packages/nextbook/src/index.ts` is the public API entry point
- **Always import directly from source files** - Import from the actual file where the code is defined
- This improves tree-shaking, makes dependencies explicit, and reduces circular dependency issues
- **Avoid dynamic imports** - Prefer static `import` over `await import()`. Only use dynamic imports for genuine code splitting or conditional loading based on runtime conditions.

**Function Parameters:**

- Prefer object parameters over multiple direct parameters
- Example: `function foo({ name, age }: { name: string; age: number })` instead of `function foo(name: string, age: number)`

**Comments:**

- Do NOT add comments explaining what changes you just made
- Only add comments for complex logic that isn't self-evident
- Use JSDoc-style comments for public APIs

**Console Logging:**

- Always stringify objects: `console.log('DEBUG:', JSON.stringify(data, null, 2))`
- **Always clean up debug code** - Remove all console logs and debugging code once the root cause is found

**React Conventions:**

- **ALWAYS follow the Rules of Hooks**:
  - Only call hooks at the top level - never inside loops, conditions, or nested functions
  - Do not return early if there's a hook later in the component
  - Hooks must be called in the same order every render

**Testing:**

- **Unit tests are REQUIRED** - Always add unit tests when adding or modifying functions/utilities. Tests ensure a solid and reliable product.
- Test files should be co-located with source files (e.g., `schema.ts` → `schema.test.ts`)
- Run `bun test` to execute all unit tests
- NEVER use `timeout` parameters when running tests - run tests normally without artificial timeouts
- Trust the test framework's default timeout behavior
- **Post-task test verification** - After completing any task, verify test coverage for changed files:
  - Modified behavior → Update affected tests to match
  - New functionality → Add tests for it
  - Tests must catch regressions to enable confident iteration
  - A task is not complete until its tests are updated and passing

**E2E Testing (Playwright):**

- **Prefer unit tests over e2e** - Unit/React tests are much faster to run and easier to fix. Use e2e only for: full user flows, visual regressions, complex multi-component interactions
- **Minimize test count** - Prefer fewer, comprehensive tests over many small ones. Combine related actions into single tests
- **Avoid trivial tests** - Don't test if something "renders" - other tests already verify this implicitly
- **Each test must be fast** - E2e tests are expensive; keep them lean and purposeful
- **Visual snapshots catch regressions** - Use `toHaveScreenshot()` for components where visual appearance matters
- Run `bun e2e` to execute all e2e tests (starts dev server automatically via Playwright's webServer config)

**Implementation Standards:**

- When asked to implement something, implement it FULLY and completely
- NEVER add placeholder comments like "to be implemented later"
- If something cannot be completed, explain why explicitly rather than leaving incomplete code
- **NEVER create documentation files** unless explicitly requested
  - The only exception: updating existing CLAUDE.md when architecture changes

**Documentation Synchronization:**

- **THE root README.md MUST BE KEPT IN SYNC WITH THE CODE AT ALL TIMES**
- When making ANY changes to the nextbook package:
  1. Update the code
  2. **Immediately update the root README.md to reflect those changes**
  3. Verify code examples in README are copy-paste correct
- The root README is the primary documentation for users
- **Manual Setup must match CLI output** - The manual setup steps in README must produce the same result as `npx nextbook init`. When updating CLI templates (`src/cli/templates.ts`), also update the README manual setup section to match.

**Marketing Website Synchronization (apps/web):**

- **The apps/web marketing site MUST also stay in sync with the nextbook package**
- When making changes to nextbook features or API:
  1. Update the package code
  2. Update the root README.md
  3. **Update apps/web if affected** (code examples, feature descriptions, comparison table)
- Key files to update in apps/web when features change:
  - `components/landing/features.tsx` - Feature descriptions
  - `components/landing/code-demo.tsx` - Code examples
  - `components/landing/comparison.tsx` - Comparison table
  - `components/landing/hero.tsx` - Taglines and value prop

## Important Notes

- **Package Manager:** Always use `bun` instead of npm/yarn/pnpm
- **Node Version:** Requires Node.js >= 20
- **React Version:** Uses React 19.2.0 (latest)
- **Next.js Version:** Uses Next.js 16.0.1
- **Server Components:** Default to Server Components; use `"use client"` directive only when needed
- **Import Paths:** Use workspace aliases (`nextbook`, `@workspace/typescript-config`)
