import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  wrapWithMarkers,
  updateAiTaoSection,
  ensureGitignore,
  hasAiTaoSection,
  detectExistingTools,
  aiTao,
  fetchTemplate,
  fetchFlavor,
  AVAILABLE_FLAVORS,
  SUPPORTED_TOOLS,
  TOOL_CONFIG,
  type Tool,
} from "./ai-tao.js";

const TEST_DIR = join(import.meta.dirname, ".test-temp");

const START_MARKER = "<!-- AI-TAO:START -->";
const END_MARKER = "<!-- AI-TAO:END -->";

// Mock template content for testing (to avoid GitHub fetch)
const MOCK_TEMPLATE = `# CLAUDE.md

This is mock template content for testing.

## Claude Code Guidelines

Some guidelines here.`;

describe("wrapWithMarkers", () => {
  test("wraps content with start and end markers", () => {
    const content = "Hello World";
    const result = wrapWithMarkers(content);

    expect(result).toBe(`${START_MARKER}\nHello World\n${END_MARKER}`);
  });

  test("handles multiline content", () => {
    const content = "Line 1\nLine 2\nLine 3";
    const result = wrapWithMarkers(content);

    expect(result).toBe(`${START_MARKER}\nLine 1\nLine 2\nLine 3\n${END_MARKER}`);
  });

  test("handles empty content", () => {
    const result = wrapWithMarkers("");
    expect(result).toBe(`${START_MARKER}\n\n${END_MARKER}`);
  });
});

describe("updateAiTaoSection", () => {
  test("appends to empty file", () => {
    const result = updateAiTaoSection("", "New content");

    expect(result).toBe(`${START_MARKER}\nNew content\n${END_MARKER}\n`);
  });

  test("appends to file with existing content but no markers", () => {
    const existing = "# My Project\n\nSome description.";
    const result = updateAiTaoSection(existing, "Template content");

    expect(result).toBe(
      `# My Project\n\nSome description.\n\n${START_MARKER}\nTemplate content\n${END_MARKER}\n`
    );
  });

  test("replaces existing section between markers", () => {
    const existing = `# Header

${START_MARKER}
Old content
${END_MARKER}

# Footer`;

    const result = updateAiTaoSection(existing, "New content");

    expect(result).toBe(`# Header

${START_MARKER}
New content
${END_MARKER}

# Footer`);
  });

  test("preserves content before and after markers", () => {
    const existing = `Before content
${START_MARKER}
Old template
${END_MARKER}
After content`;

    const result = updateAiTaoSection(existing, "Updated template");

    expect(result).toBe(`Before content
${START_MARKER}
Updated template
${END_MARKER}
After content`);
  });

  test("handles markers with no content between them", () => {
    const existing = `${START_MARKER}${END_MARKER}`;
    const result = updateAiTaoSection(existing, "New content");

    expect(result).toBe(`${START_MARKER}\nNew content\n${END_MARKER}`);
  });
});

describe("hasAiTaoSection", () => {
  test("returns true when both markers present", () => {
    const content = `${START_MARKER}\nContent\n${END_MARKER}`;
    expect(hasAiTaoSection(content)).toBe(true);
  });

  test("returns false when no markers", () => {
    const content = "Just some content";
    expect(hasAiTaoSection(content)).toBe(false);
  });

  test("returns false when only start marker", () => {
    const content = `${START_MARKER}\nContent`;
    expect(hasAiTaoSection(content)).toBe(false);
  });

  test("returns false when only end marker", () => {
    const content = `Content\n${END_MARKER}`;
    expect(hasAiTaoSection(content)).toBe(false);
  });
});

describe("ensureGitignore", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test("creates .gitignore if it does not exist", () => {
    const result = ensureGitignore(["CLAUDE.local.md"], TEST_DIR);

    expect(result).toBe(true);
    expect(existsSync(join(TEST_DIR, ".gitignore"))).toBe(true);
    expect(readFileSync(join(TEST_DIR, ".gitignore"), "utf-8")).toBe(
      "CLAUDE.local.md\n"
    );
  });

  test("appends to existing .gitignore", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "node_modules\n", "utf-8");

    const result = ensureGitignore(["CLAUDE.local.md"], TEST_DIR);

    expect(result).toBe(true);
    expect(readFileSync(join(TEST_DIR, ".gitignore"), "utf-8")).toBe(
      "node_modules\nCLAUDE.local.md\n"
    );
  });

  test("appends newline if .gitignore does not end with newline", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "node_modules", "utf-8");

    const result = ensureGitignore(["CLAUDE.local.md"], TEST_DIR);

    expect(result).toBe(true);
    expect(readFileSync(join(TEST_DIR, ".gitignore"), "utf-8")).toBe(
      "node_modules\nCLAUDE.local.md\n"
    );
  });

  test("does not duplicate if already in .gitignore", () => {
    writeFileSync(
      join(TEST_DIR, ".gitignore"),
      "node_modules\nCLAUDE.local.md\n",
      "utf-8"
    );

    const result = ensureGitignore(["CLAUDE.local.md"], TEST_DIR);

    expect(result).toBe(false);
    expect(readFileSync(join(TEST_DIR, ".gitignore"), "utf-8")).toBe(
      "node_modules\nCLAUDE.local.md\n"
    );
  });

  test("handles multiple files", () => {
    const result = ensureGitignore(
      ["CLAUDE.local.md", ".cursorrules", ".windsurfrules"],
      TEST_DIR
    );

    expect(result).toBe(true);
    const content = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
    expect(content).toContain("CLAUDE.local.md");
    expect(content).toContain(".cursorrules");
    expect(content).toContain(".windsurfrules");
  });

  test("handles empty .gitignore", () => {
    writeFileSync(join(TEST_DIR, ".gitignore"), "", "utf-8");

    const result = ensureGitignore(["CLAUDE.local.md"], TEST_DIR);

    expect(result).toBe(true);
    expect(readFileSync(join(TEST_DIR, ".gitignore"), "utf-8")).toBe(
      "CLAUDE.local.md\n"
    );
  });
});

describe("detectExistingTools", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test("returns empty array when no files exist", () => {
    const result = detectExistingTools(TEST_DIR);
    expect(result).toEqual([]);
  });

  test("detects CLAUDE.md with AI-TAO section", () => {
    writeFileSync(
      join(TEST_DIR, "CLAUDE.md"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );

    const result = detectExistingTools(TEST_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].tool).toBe("claude");
    expect(result[0].isLocal).toBe(false);
  });

  test("detects CLAUDE.local.md over CLAUDE.md", () => {
    writeFileSync(
      join(TEST_DIR, "CLAUDE.md"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );
    writeFileSync(
      join(TEST_DIR, "CLAUDE.local.md"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );

    const result = detectExistingTools(TEST_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].tool).toBe("claude");
    expect(result[0].isLocal).toBe(true);
  });

  test("detects .cursorrules with AI-TAO section", () => {
    writeFileSync(
      join(TEST_DIR, ".cursorrules"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );

    const result = detectExistingTools(TEST_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].tool).toBe("cursor");
  });

  test("detects .windsurfrules with AI-TAO section", () => {
    writeFileSync(
      join(TEST_DIR, ".windsurfrules"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );

    const result = detectExistingTools(TEST_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].tool).toBe("windsurf");
  });

  test("detects .github/copilot-instructions.md with AI-TAO section", () => {
    mkdirSync(join(TEST_DIR, ".github"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".github/copilot-instructions.md"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );

    const result = detectExistingTools(TEST_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].tool).toBe("copilot");
  });

  test("detects multiple tools", () => {
    writeFileSync(
      join(TEST_DIR, "CLAUDE.md"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );
    writeFileSync(
      join(TEST_DIR, ".cursorrules"),
      `${START_MARKER}\nContent\n${END_MARKER}`,
      "utf-8"
    );

    const result = detectExistingTools(TEST_DIR);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.tool)).toContain("claude");
    expect(result.map((r) => r.tool)).toContain("cursor");
  });

  test("ignores files without AI-TAO section", () => {
    writeFileSync(join(TEST_DIR, "CLAUDE.md"), "Just some content", "utf-8");
    writeFileSync(join(TEST_DIR, ".cursorrules"), "Some rules", "utf-8");

    const result = detectExistingTools(TEST_DIR);
    expect(result).toEqual([]);
  });
});

describe("fetchTemplate", () => {
  // This test requires the ai-tao repo to exist on GitHub
  test.skip("fetches template from GitHub", async () => {
    const template = await fetchTemplate();

    expect(template).toContain("# CLAUDE.md");
    expect(template).toContain("Claude Code");
  });
});

describe("fetchFlavor", () => {
  // This test requires the flavor file to be pushed to GitHub first
  test.skip("fetches nextjs flavor from GitHub", async () => {
    const flavor = await fetchFlavor("nextjs");

    expect(flavor).toContain("Next.js");
    expect(flavor).toContain("App Router");
  });

  test("AVAILABLE_FLAVORS contains nextjs", () => {
    expect(AVAILABLE_FLAVORS).toContain("nextjs");
  });
});

describe("TOOL_CONFIG", () => {
  test("contains all supported tools", () => {
    for (const tool of SUPPORTED_TOOLS) {
      expect(TOOL_CONFIG[tool]).toBeDefined();
      expect(TOOL_CONFIG[tool].name).toBeTruthy();
      expect(TOOL_CONFIG[tool].sharedFile).toBeTruthy();
      expect(TOOL_CONFIG[tool].localFile).toBeTruthy();
    }
  });

  test("claude has different local and shared files", () => {
    expect(TOOL_CONFIG.claude.sharedFile).toBe("CLAUDE.md");
    expect(TOOL_CONFIG.claude.localFile).toBe("CLAUDE.local.md");
  });

  test("cursor has same local and shared files", () => {
    expect(TOOL_CONFIG.cursor.sharedFile).toBe(".cursorrules");
    expect(TOOL_CONFIG.cursor.localFile).toBe(".cursorrules");
  });

  test("windsurf has same local and shared files", () => {
    expect(TOOL_CONFIG.windsurf.sharedFile).toBe(".windsurfrules");
    expect(TOOL_CONFIG.windsurf.localFile).toBe(".windsurfrules");
  });

  test("copilot has same local and shared files", () => {
    expect(TOOL_CONFIG.copilot.sharedFile).toBe(".github/copilot-instructions.md");
    expect(TOOL_CONFIG.copilot.localFile).toBe(".github/copilot-instructions.md");
  });
});

describe("aiTao", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("Claude Code", () => {
    test("creates CLAUDE.md when selected (shared mode)", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["claude"],
        _isLocal: false,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("claude");
      expect(result.files[0].filename).toBe("CLAUDE.md");
      expect(result.files[0].created).toBe(true);
      expect(result.isLocal).toBe(false);
      expect(result.gitignoreUpdated).toBe(false);

      const content = readFileSync(join(TEST_DIR, "CLAUDE.md"), "utf-8");
      expect(content).toContain(START_MARKER);
      expect(content).toContain(END_MARKER);
      expect(content).toContain("# CLAUDE.md");
    });

    test("creates CLAUDE.local.md when selected (local mode)", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["claude"],
        _isLocal: true,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("claude");
      expect(result.files[0].filename).toBe("CLAUDE.local.md");
      expect(result.files[0].created).toBe(true);
      expect(result.isLocal).toBe(true);
      expect(result.gitignoreUpdated).toBe(true);

      expect(existsSync(join(TEST_DIR, "CLAUDE.local.md"))).toBe(true);
      const gitignore = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain("CLAUDE.local.md");
    });

    test("updates existing CLAUDE.md preserving content outside markers", async () => {
      const initialContent = `# My Custom Header

Some project-specific notes.

${START_MARKER}
Old template content
${END_MARKER}

## My Custom Footer

More notes here.`;

      writeFileSync(join(TEST_DIR, "CLAUDE.md"), initialContent, "utf-8");

      const result = await aiTao({ cwd: TEST_DIR, _templateContent: MOCK_TEMPLATE });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("claude");
      expect(result.files[0].created).toBe(false);

      const content = readFileSync(join(TEST_DIR, "CLAUDE.md"), "utf-8");
      expect(content).toContain("# My Custom Header");
      expect(content).toContain("Some project-specific notes.");
      expect(content).toContain("## My Custom Footer");
      expect(content).toContain("More notes here.");
      expect(content).not.toContain("Old template content");
      expect(content).toContain("# CLAUDE.md");
    });
  });

  describe("Cursor", () => {
    test("creates .cursorrules when selected (shared mode)", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["cursor"],
        _isLocal: false,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("cursor");
      expect(result.files[0].filename).toBe(".cursorrules");
      expect(result.files[0].created).toBe(true);

      const content = readFileSync(join(TEST_DIR, ".cursorrules"), "utf-8");
      expect(content).toContain(START_MARKER);
      expect(content).toContain(END_MARKER);
    });

    test("creates .cursorrules when selected (local mode) and gitignores it", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["cursor"],
        _isLocal: true,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe(".cursorrules");
      expect(result.gitignoreUpdated).toBe(true);

      const gitignore = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".cursorrules");
    });

    test("updates existing .cursorrules with AI-TAO section", async () => {
      writeFileSync(
        join(TEST_DIR, ".cursorrules"),
        `${START_MARKER}\nOld content\n${END_MARKER}`,
        "utf-8"
      );

      const result = await aiTao({ cwd: TEST_DIR, _templateContent: MOCK_TEMPLATE });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("cursor");
      expect(result.files[0].created).toBe(false);

      const content = readFileSync(join(TEST_DIR, ".cursorrules"), "utf-8");
      expect(content).not.toContain("Old content");
      expect(content).toContain("# CLAUDE.md");
    });
  });

  describe("Windsurf", () => {
    test("creates .windsurfrules when selected (shared mode)", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["windsurf"],
        _isLocal: false,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("windsurf");
      expect(result.files[0].filename).toBe(".windsurfrules");
      expect(result.files[0].created).toBe(true);

      const content = readFileSync(join(TEST_DIR, ".windsurfrules"), "utf-8");
      expect(content).toContain(START_MARKER);
      expect(content).toContain(END_MARKER);
    });

    test("creates .windsurfrules when selected (local mode) and gitignores it", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["windsurf"],
        _isLocal: true,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe(".windsurfrules");
      expect(result.gitignoreUpdated).toBe(true);

      const gitignore = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".windsurfrules");
    });

    test("updates existing .windsurfrules with AI-TAO section", async () => {
      writeFileSync(
        join(TEST_DIR, ".windsurfrules"),
        `${START_MARKER}\nOld content\n${END_MARKER}`,
        "utf-8"
      );

      const result = await aiTao({ cwd: TEST_DIR, _templateContent: MOCK_TEMPLATE });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("windsurf");
      expect(result.files[0].created).toBe(false);
    });
  });

  describe("GitHub Copilot", () => {
    test("creates .github/copilot-instructions.md when selected (shared mode)", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["copilot"],
        _isLocal: false,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("copilot");
      expect(result.files[0].filename).toBe(".github/copilot-instructions.md");
      expect(result.files[0].created).toBe(true);

      expect(existsSync(join(TEST_DIR, ".github"))).toBe(true);
      const content = readFileSync(
        join(TEST_DIR, ".github/copilot-instructions.md"),
        "utf-8"
      );
      expect(content).toContain(START_MARKER);
      expect(content).toContain(END_MARKER);
    });

    test("creates .github/copilot-instructions.md when selected (local mode) and gitignores it", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["copilot"],
        _isLocal: true,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe(".github/copilot-instructions.md");
      expect(result.gitignoreUpdated).toBe(true);

      const gitignore = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain(".github/copilot-instructions.md");
    });

    test("updates existing .github/copilot-instructions.md with AI-TAO section", async () => {
      mkdirSync(join(TEST_DIR, ".github"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, ".github/copilot-instructions.md"),
        `${START_MARKER}\nOld content\n${END_MARKER}`,
        "utf-8"
      );

      const result = await aiTao({ cwd: TEST_DIR, _templateContent: MOCK_TEMPLATE });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("copilot");
      expect(result.files[0].created).toBe(false);
    });
  });

  describe("Multiple tools", () => {
    test("creates files for all selected tools", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["claude", "cursor", "windsurf", "copilot"],
        _isLocal: false,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(4);

      const tools = result.files.map((f) => f.tool);
      expect(tools).toContain("claude");
      expect(tools).toContain("cursor");
      expect(tools).toContain("windsurf");
      expect(tools).toContain("copilot");

      expect(existsSync(join(TEST_DIR, "CLAUDE.md"))).toBe(true);
      expect(existsSync(join(TEST_DIR, ".cursorrules"))).toBe(true);
      expect(existsSync(join(TEST_DIR, ".windsurfrules"))).toBe(true);
      expect(existsSync(join(TEST_DIR, ".github/copilot-instructions.md"))).toBe(true);
    });

    test("updates all existing tools", async () => {
      // Create existing files
      writeFileSync(
        join(TEST_DIR, "CLAUDE.md"),
        `${START_MARKER}\nOld\n${END_MARKER}`,
        "utf-8"
      );
      writeFileSync(
        join(TEST_DIR, ".cursorrules"),
        `${START_MARKER}\nOld\n${END_MARKER}`,
        "utf-8"
      );

      const result = await aiTao({ cwd: TEST_DIR, _templateContent: MOCK_TEMPLATE });

      expect(result.files).toHaveLength(2);
      expect(result.files.every((f) => f.created === false)).toBe(true);
    });

    test("local mode gitignores all files", async () => {
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["claude", "cursor", "windsurf"],
        _isLocal: true,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.gitignoreUpdated).toBe(true);

      const gitignore = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      expect(gitignore).toContain("CLAUDE.local.md");
      expect(gitignore).toContain(".cursorrules");
      expect(gitignore).toContain(".windsurfrules");
    });
  });

  describe("Update mode detection", () => {
    test("detects update mode when existing AI-TAO files found", async () => {
      // Create an existing AI-TAO managed file
      writeFileSync(
        join(TEST_DIR, ".cursorrules"),
        `${START_MARKER}\nContent\n${END_MARKER}`,
        "utf-8"
      );

      // Should automatically update without prompts
      const result = await aiTao({ cwd: TEST_DIR, _templateContent: MOCK_TEMPLATE });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("cursor");
      expect(result.files[0].created).toBe(false);
    });

    test("ignores files without AI-TAO markers in detection", async () => {
      // Create files without AI-TAO markers
      writeFileSync(join(TEST_DIR, "CLAUDE.md"), "Some content", "utf-8");
      writeFileSync(join(TEST_DIR, ".cursorrules"), "Some rules", "utf-8");

      // Should go to setup mode (we skip prompts in test)
      const result = await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["claude"],
        _isLocal: false,
        _templateContent: MOCK_TEMPLATE,
      });

      expect(result.files).toHaveLength(1);
      expect(result.files[0].tool).toBe("claude");
      // The existing CLAUDE.md without markers will be appended to
      expect(result.files[0].created).toBe(false);

      const content = readFileSync(join(TEST_DIR, "CLAUDE.md"), "utf-8");
      expect(content).toContain("Some content");
      expect(content).toContain(START_MARKER);
    });
  });

  describe("does not duplicate .gitignore entries", () => {
    test("on repeated local runs", async () => {
      // First run
      await aiTao({
        cwd: TEST_DIR,
        _skipPrompts: true,
        _selectedTools: ["claude"],
        _isLocal: true,
        _templateContent: MOCK_TEMPLATE,
      });

      // Second run (update mode)
      const result = await aiTao({ cwd: TEST_DIR, _templateContent: MOCK_TEMPLATE });

      expect(result.gitignoreUpdated).toBe(false);

      const gitignore = readFileSync(join(TEST_DIR, ".gitignore"), "utf-8");
      const matches = gitignore.match(/CLAUDE\.local\.md/g);
      expect(matches?.length).toBe(1);
    });
  });

  // These tests require flavor files to be pushed to GitHub first
  test.skip("adds nextjs flavor when requested", async () => {
    const result = await aiTao({
      cwd: TEST_DIR,
      _skipPrompts: true,
      _selectedTools: ["claude"],
      _isLocal: false,
      _selectedFlavors: ["nextjs"],
    });

    expect(result.flavorsAdded).toEqual(["nextjs"]);

    const content = readFileSync(join(TEST_DIR, "CLAUDE.md"), "utf-8");
    expect(content).toContain("Next.js");
    expect(content).toContain("App Router");
    expect(content).toContain("Server Components");
  });
});
