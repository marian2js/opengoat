/**
 * Generates CREDITS.md and copies LICENSE files for vendored skill directories.
 */

export interface CreditInfo {
  repoName: string;
  repoUrl: string;
  commitSha: string;
  license: string;
}

export function generateCredits(info: CreditInfo): string {
  return `# Credits

This directory contains vendored skills from the **${info.repoName}** project.

- **Source**: ${info.repoUrl}
- **Commit**: ${info.commitSha}
- **License**: ${info.license}

These files were processed by the OpenGoat skill vendoring pipeline.
Original content is copyright of the respective authors under the ${info.license} license.
See the LICENSE file in this directory for the full license text.
`;
}
