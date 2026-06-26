// oxlint-disable no-console

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { OpenRouter } from "@openrouter/sdk";

import { formatError } from "../src/utils/error.js";
import type { SecurityScanResult } from "./security-scan-lib.js";
import {
  countHighSeverityVulnerabilities,
  formatEmailBody,
  generateOverallSummary,
  getXmlFiles,
  runSecurityScan,
  sendEmail,
  validateEnv,
} from "./security-scan-lib.js";

const RESPONSE_FORMAT_DESCRIPTION = `\
The content below is a repomix-packed XML snapshot of a codebase. Each file is wrapped in a \
<file path="..."> element, and lines are prefixed with their line numbers.

## Response Format

Report each vulnerability as a JSON object with the following keys:
- **severity**: One of "low", "medium", "high", "critical"
- **reason**: A concise description of the vulnerability in Japanese
- **filePath**: The file path where the vulnerability was found
- **line**: The line range (e.g., "L10", "L10-L11")
`;

const main = async (): Promise<void> => {
  const env = validateEnv();
  const {
    openrouterApiKey,
    model,
    securityScanPrompt,
    resendApiKey,
    resendFromEmail,
    securityScanRecipient,
  } = env;
  const prompt = `${RESPONSE_FORMAT_DESCRIPTION}\n${securityScanPrompt}`;

  const client = new OpenRouter({ apiKey: openrouterApiKey });

  const baseDir = process.cwd();
  const xmlFiles = getXmlFiles({ dir: baseDir });

  if (xmlFiles.length === 0) {
    console.log("No XML files found to scan. Skipping.");
    return;
  }

  console.log(`Found ${xmlFiles.length} XML files to scan`);

  const results = new Map<string, SecurityScanResult>();
  const errors: string[] = [];

  for (const xmlPath of xmlFiles) {
    const filename = basename(xmlPath);
    console.log(`Scanning ${filename}...`);

    try {
      const fileContent = readFileSync(xmlPath, "utf-8");
      const scanResult = await runSecurityScan({ client, fileContent, model, prompt });

      results.set(filename, scanResult);
      console.log(`  Found ${scanResult.vulnerabilities.length} vulnerabilities`);
    } catch (error: unknown) {
      const message = `Failed to scan ${filename}: ${formatError(error)}`;
      console.error(message);
      errors.push(message);
    }
  }

  console.log("All scans completed");

  if (results.size === 0) {
    throw new Error("All scans failed. No results to report.");
  }

  if (errors.length > 0) {
    console.warn(`${errors.length} file(s) failed to scan`);
  }

  // Filter results to only include XML files with high+ severity vulnerabilities
  const highSeverityResults = new Map<string, SecurityScanResult>();
  for (const [filename, result] of results.entries()) {
    const hasHighSeverity = result.vulnerabilities.some(
      (v) => v.severity === "high" || v.severity === "critical",
    );
    if (hasHighSeverity) {
      highSeverityResults.set(filename, result);
    }
  }

  if (highSeverityResults.size === 0) {
    console.log("No high+ severity vulnerabilities found. Skipping email notification.");
    return;
  }

  const totalHighVulnerabilities = countHighSeverityVulnerabilities({
    results: highSeverityResults,
  });
  const date = new Date().toISOString().split("T")[0];
  const subject = `Security Scan Report - ${date} (${totalHighVulnerabilities} high+ vulnerabilities found)`;

  // Generate an AI summary from the full scan results to prepend to the email.
  // Failure here must not block the notification, so fall back to no summary.
  let overallSummary: string | undefined;
  try {
    overallSummary = await generateOverallSummary({ client, model, results });
    console.log("Generated AI summary");
  } catch (error: unknown) {
    console.warn(`Failed to generate AI summary: ${formatError(error)}`);
  }

  const emailBody = formatEmailBody({ results: highSeverityResults, overallSummary });
  await sendEmail({
    apiKey: resendApiKey,
    from: resendFromEmail,
    to: securityScanRecipient,
    subject,
    body: emailBody,
  });

  console.log("Email sent successfully");
};

main().catch((error: unknown) => {
  console.error("Error:", formatError(error));
  process.exit(1);
});
