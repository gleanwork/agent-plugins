#!/usr/bin/env node
import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
  );
}

const rootPackage = readJson("package.json");
const mcpPackage = readJson("shared/glean/mcp/package.json");
const releaseConfig = readJson(".release-it.json");
const bumperOutput = releaseConfig.plugins?.["@release-it/bumper"]?.out;

if (bumperOutput !== "shared/glean/mcp/package.json") {
  throw new Error(
    "release-it must explicitly bump shared/glean/mcp/package.json via @release-it/bumper.",
  );
}

if (rootPackage.version !== mcpPackage.version) {
  throw new Error(
    `Release versions differ: root=${rootPackage.version}, MCP=${mcpPackage.version}.`,
  );
}

console.log(
  `Release version ${rootPackage.version} targets the root and local MCP packages.`,
);
