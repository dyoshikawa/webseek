import { describe, expect, it } from "vite-plus/test";

import { buildSkillContent, parseReadme } from "./sync-skill-docs.js";

const SAMPLE_README = `# webseek

Intro paragraph describing the tool.

## Providers

Provider details.

## CLI mode

\`\`\`bash
webseek "<query>" -p google
\`\`\`

### Subsection

Nested content.

## Install

Install steps.

## MCP server mode

MCP details.

## Library (programmatic API)

Library details.

## Authentication

Auth details.

## Caveats

Caveat details.

## Architecture

Internal layout.

## Development

Contributor steps.

## Releasing

Release steps.
`;

describe("parseReadme", () => {
  it("extracts the intro and top-level sections", () => {
    const { intro, sections } = parseReadme(SAMPLE_README);
    expect(intro).toBe("Intro paragraph describing the tool.");
    expect(sections.map((s) => s.heading)).toEqual([
      "Providers",
      "CLI mode",
      "Install",
      "MCP server mode",
      "Library (programmatic API)",
      "Authentication",
      "Caveats",
      "Architecture",
      "Development",
      "Releasing",
    ]);
  });

  it("keeps nested ### headings inside their parent section", () => {
    const { sections } = parseReadme(SAMPLE_README);
    const cli = sections.find((s) => s.heading === "CLI mode");
    expect(cli?.body).toContain("### Subsection");
    expect(cli?.body).toContain("Nested content.");
  });
});

describe("buildSkillContent", () => {
  it("emits frontmatter, the title, and the intro", () => {
    const content = buildSkillContent(SAMPLE_README);
    expect(content.startsWith("---\nname: webseek\n")).toBe(true);
    expect(content).toContain("# webseek");
    expect(content).toContain("Intro paragraph describing the tool.");
  });

  it("includes user-facing sections and excludes contributor sections", () => {
    const content = buildSkillContent(SAMPLE_README);
    for (const heading of [
      "## Providers",
      "## Install",
      "## CLI mode",
      "## MCP server mode",
      "## Library (programmatic API)",
      "## Authentication",
      "## Caveats",
    ]) {
      expect(content).toContain(heading);
    }
    expect(content).not.toContain("## Architecture");
    expect(content).not.toContain("## Development");
    expect(content).not.toContain("## Releasing");
  });

  it("throws when an expected README section is missing", () => {
    const incomplete = "# webseek\n\nIntro.\n\n## Providers\n\nDetails.\n";
    expect(() => buildSkillContent(incomplete)).toThrowError(/Install/);
  });
});
