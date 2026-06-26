// oxlint-disable no-console

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { runCli } from "repomix";

type Variant = {
  name: string;
  include?: string[];
  ignore?: string[];
};

const getSubdirectories = (dirPath: string): string[] => {
  return readdirSync(dirPath)
    .filter((entry) => statSync(join(dirPath, entry)).isDirectory())
    .toSorted();
};

const baseDir = process.cwd();

// Guard every variant against picking up the XML files this script generates,
// regardless of run order.
const OUTPUT_GUARD = "repomix-output*";

const buildVariants = (): Variant[] => {
  const srcDirs = getSubdirectories(join(baseDir, "src"));

  // The full codebase in one file, plus one file per top-level src directory so
  // that each scan stays within the model's context window.
  const variants: Variant[] = [{ name: "repomix-output-full" }];

  for (const dir of srcDirs) {
    variants.push({
      name: `repomix-output-${dir}`,
      include: [`src/${dir}/**/*.ts`],
    });
  }

  // Everything outside src/ (config files, workflows, etc.).
  variants.push({
    name: "repomix-output-configs",
    ignore: ["src/**/*"],
  });

  return variants;
};

const generateVariants = async (): Promise<void> => {
  const variants = buildVariants();

  for (const variant of variants) {
    const xmlPath = join(baseDir, `${variant.name}.xml`);
    const ignore = [OUTPUT_GUARD, ...(variant.ignore ?? [])];

    console.log(`Generating ${variant.name}.xml...`);

    const result = await runCli(["."], baseDir, {
      output: xmlPath,
      style: "xml",
      include: variant.include?.join(","),
      ignore: ignore.join(","),
    });

    if (result) {
      console.log(
        `  Files: ${result.packResult.totalFiles}, Tokens: ${result.packResult.totalTokens}`,
      );
    }

    console.log(`  Done: ${xmlPath}\n`);
  }

  console.log("All variants generated successfully!");
};

generateVariants().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
