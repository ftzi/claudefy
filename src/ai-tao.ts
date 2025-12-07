import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from "fs";
import { join, dirname } from "path";
import * as readline from "readline";

const BASE_URL =
  "https://raw.githubusercontent.com/ftzi/ai-tao/refs/heads/main/templates";
const TEMPLATE_URL = `${BASE_URL}/main.md`;
const FLAVOR_URL = (flavor: string) => `${BASE_URL}/flavors/${flavor}.md`;

const START_MARKER = "<!-- AI-TAO:START -->";
const END_MARKER = "<!-- AI-TAO:END -->";

export const AVAILABLE_FLAVORS = ["nextjs"] as const;
export type Flavor = (typeof AVAILABLE_FLAVORS)[number];

export const SUPPORTED_TOOLS = ["claude", "cursor", "windsurf", "copilot"] as const;
export type Tool = (typeof SUPPORTED_TOOLS)[number];

export type ToolConfig = {
  name: string;
  sharedFile: string;
  localFile: string;
};

export const TOOL_CONFIG: Record<Tool, ToolConfig> = {
  claude: {
    name: "Claude Code",
    sharedFile: "CLAUDE.md",
    localFile: "CLAUDE.local.md",
  },
  cursor: {
    name: "Cursor",
    sharedFile: ".cursorrules",
    localFile: ".cursorrules",
  },
  windsurf: {
    name: "Windsurf",
    sharedFile: ".windsurfrules",
    localFile: ".windsurfrules",
  },
  copilot: {
    name: "GitHub Copilot",
    sharedFile: ".github/copilot-instructions.md",
    localFile: ".github/copilot-instructions.md",
  },
};

export type AiTaoOptions = {
  cwd?: string;
  // For testing: skip interactive prompts
  _skipPrompts?: boolean;
  _selectedTools?: Tool[];
  _isLocal?: boolean;
  _selectedFlavors?: Flavor[];
  // For testing: provide template content directly
  _templateContent?: string;
};

export type AiTaoResult = {
  files: Array<{
    tool: Tool;
    filename: string;
    created: boolean;
  }>;
  gitignoreUpdated: boolean;
  flavorsAdded: Flavor[];
  isLocal: boolean;
};

// Interactive prompt helpers
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function promptQuestion(
  rl: readline.Interface,
  question: string
): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

export async function promptToolSelection(
  rl: readline.Interface
): Promise<Tool[]> {
  console.log("\nWhich AI tools do you want to set up?\n");

  const toolList = SUPPORTED_TOOLS.map((tool, i) => {
    const config = TOOL_CONFIG[tool];
    return `  ${i + 1}. ${config.name} (${config.sharedFile})`;
  }).join("\n");

  console.log(toolList);
  console.log("\nEnter numbers separated by spaces (e.g., '1 2 3'), or 'all':");

  const answer = await promptQuestion(rl, "> ");

  if (answer === "all" || answer === "a") {
    return [...SUPPORTED_TOOLS];
  }

  const numbers = answer
    .split(/[\s,]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= SUPPORTED_TOOLS.length);

  if (numbers.length === 0) {
    // Default to claude if no valid selection
    console.log("No valid selection, defaulting to Claude Code.");
    return ["claude"];
  }

  return numbers.map((n) => SUPPORTED_TOOLS[n - 1]);
}

export async function promptLocalOrShared(
  rl: readline.Interface
): Promise<boolean> {
  console.log("\nShould the configuration files be:\n");
  console.log("  1. Shared (committed to git)");
  console.log("  2. Local (added to .gitignore)\n");

  const answer = await promptQuestion(rl, "Enter 1 or 2 [1]: ");

  return answer === "2" || answer === "local" || answer === "l";
}

export async function promptFlavorSelection(
  rl: readline.Interface
): Promise<Flavor[]> {
  console.log("\nWhich frameworks/tools is your project using?\n");

  const flavorList = AVAILABLE_FLAVORS.map((flavor, i) => {
    return `  ${i + 1}. ${flavor}`;
  }).join("\n");

  console.log(flavorList);
  console.log("  0. None\n");
  console.log("Enter numbers separated by spaces, or press Enter for none:");

  const answer = await promptQuestion(rl, "> ");

  if (!answer || answer === "0" || answer === "none" || answer === "n") {
    return [];
  }

  const numbers = answer
    .split(/[\s,]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= AVAILABLE_FLAVORS.length);

  return numbers.map((n) => AVAILABLE_FLAVORS[n - 1]);
}

export async function fetchTemplate(): Promise<string> {
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch template: ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

export async function fetchFlavor(flavor: Flavor): Promise<string> {
  const response = await fetch(FLAVOR_URL(flavor));
  if (!response.ok) {
    throw new Error(
      `Failed to fetch flavor '${flavor}': ${response.status} ${response.statusText}`
    );
  }
  return response.text();
}

export function wrapWithMarkers(content: string): string {
  return `${START_MARKER}\n${content}\n${END_MARKER}`;
}

export function updateAiTaoSection(
  existingContent: string,
  newTemplateContent: string
): string {
  const wrappedContent = wrapWithMarkers(newTemplateContent);

  const startIndex = existingContent.indexOf(START_MARKER);
  const endIndex = existingContent.indexOf(END_MARKER);

  // No existing markers - append the wrapped content
  if (startIndex === -1 || endIndex === -1) {
    // If file has content, add a newline separator
    if (existingContent.trim()) {
      return `${existingContent.trimEnd()}\n\n${wrappedContent}\n`;
    }
    return `${wrappedContent}\n`;
  }

  // Replace existing section
  const before = existingContent.slice(0, startIndex);
  const after = existingContent.slice(endIndex + END_MARKER.length);

  return `${before}${wrappedContent}${after}`;
}

export function hasAiTaoSection(content: string): boolean {
  return content.includes(START_MARKER) && content.includes(END_MARKER);
}

export function getFileForTool(
  tool: Tool,
  isLocal: boolean,
  cwd: string
): string {
  const config = TOOL_CONFIG[tool];
  const filename = isLocal ? config.localFile : config.sharedFile;
  return join(cwd, filename);
}

export function ensureGitignore(files: string[], cwd: string): boolean {
  const gitignorePath = join(cwd, ".gitignore");
  let updated = false;

  let content = "";
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, "utf-8");
  }

  const lines = content.split("\n").map((line) => line.trim());
  const toAdd: string[] = [];

  for (const file of files) {
    // Get relative path from cwd
    const relativePath = file.startsWith(cwd)
      ? file.slice(cwd.length + 1)
      : file;

    if (!lines.includes(relativePath)) {
      toAdd.push(relativePath);
    }
  }

  if (toAdd.length > 0) {
    const needsNewline = content.length > 0 && !content.endsWith("\n");
    const addition = toAdd.join("\n") + "\n";

    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, addition, "utf-8");
    } else {
      appendFileSync(
        gitignorePath,
        `${needsNewline ? "\n" : ""}${addition}`,
        "utf-8"
      );
    }
    updated = true;
  }

  return updated;
}

export function detectExistingTools(cwd: string): {
  tool: Tool;
  filepath: string;
  isLocal: boolean;
}[] {
  const found: { tool: Tool; filepath: string; isLocal: boolean }[] = [];

  for (const tool of SUPPORTED_TOOLS) {
    const config = TOOL_CONFIG[tool];

    // Check local file first (for Claude which has a separate local file)
    if (config.localFile !== config.sharedFile) {
      const localPath = join(cwd, config.localFile);
      if (existsSync(localPath)) {
        const content = readFileSync(localPath, "utf-8");
        if (hasAiTaoSection(content)) {
          found.push({ tool, filepath: localPath, isLocal: true });
          continue;
        }
      }
    }

    // Check shared file
    const sharedPath = join(cwd, config.sharedFile);
    if (existsSync(sharedPath)) {
      const content = readFileSync(sharedPath, "utf-8");
      if (hasAiTaoSection(content)) {
        found.push({ tool, filepath: sharedPath, isLocal: false });
      }
    }
  }

  return found;
}

export async function aiTao(
  options: AiTaoOptions = {}
): Promise<AiTaoResult> {
  const {
    cwd = process.cwd(),
    _skipPrompts = false,
    _selectedTools,
    _isLocal,
    _selectedFlavors,
    _templateContent,
  } = options;

  // Detect existing AI-TAO managed files
  const existingTools = detectExistingTools(cwd);
  const isUpdateMode = existingTools.length > 0;

  let selectedTools: Tool[];
  let isLocal: boolean;
  let flavors: Flavor[];

  if (isUpdateMode) {
    // Update mode: just update existing files, no flavor prompts
    selectedTools = existingTools.map((e) => e.tool);
    isLocal = existingTools.some((e) => e.isLocal);
    flavors = []; // Don't change flavors on update
  } else {
    // Setup mode: prompt for tools, local/shared, and flavors
    if (_skipPrompts) {
      selectedTools = _selectedTools ?? ["claude"];
      isLocal = _isLocal ?? false;
      flavors = _selectedFlavors ?? [];
    } else {
      const rl = createReadlineInterface();
      try {
        console.log("No AI-TAO configuration found.");
        selectedTools = await promptToolSelection(rl);
        isLocal = await promptLocalOrShared(rl);
        flavors = await promptFlavorSelection(rl);
      } finally {
        rl.close();
      }
    }
  }

  // Fetch template from GitHub (or use provided test content)
  const templateContent = _templateContent ?? (await fetchTemplate());

  // Fetch all requested flavors in parallel
  const flavorContents = await Promise.all(
    flavors.map(async (flavor) => {
      const content = await fetchFlavor(flavor);
      return { flavor, content };
    })
  );

  // Combine base template with flavors
  let combinedContent = templateContent;
  for (const { content } of flavorContents) {
    combinedContent += `\n\n${content}`;
  }

  const results: AiTaoResult["files"] = [];
  const filesToGitignore: string[] = [];

  for (const tool of selectedTools) {
    const config = TOOL_CONFIG[tool];
    const filename = isLocal ? config.localFile : config.sharedFile;
    const filepath = join(cwd, filename);

    // Ensure directory exists (for copilot's .github folder)
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const fileExists = existsSync(filepath);
    let finalContent: string;

    if (fileExists) {
      const existingContent = readFileSync(filepath, "utf-8");
      finalContent = updateAiTaoSection(existingContent, combinedContent);
    } else {
      finalContent = `${wrapWithMarkers(combinedContent)}\n`;
    }

    writeFileSync(filepath, finalContent, "utf-8");

    results.push({
      tool,
      filename,
      created: !fileExists,
    });

    // Track files to gitignore for local mode
    if (isLocal) {
      filesToGitignore.push(filename);
    }
  }

  // Handle .gitignore for local mode
  let gitignoreUpdated = false;
  if (isLocal && filesToGitignore.length > 0) {
    gitignoreUpdated = ensureGitignore(filesToGitignore, cwd);
  }

  return {
    files: results,
    gitignoreUpdated,
    flavorsAdded: flavors,
    isLocal,
  };
}
