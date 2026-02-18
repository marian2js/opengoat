"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { BundledTheme, PluginConfig } from "streamdown";

export const streamdownPlugins: PluginConfig = { cjk, code, math, mermaid };

export const streamdownShikiTheme: [BundledTheme, BundledTheme] = [
  "github-light-high-contrast",
  "github-dark-high-contrast",
];
