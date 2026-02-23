import { describe, expect, it } from "vitest";
import {
  resolveOpenClawOnboardingGatewayStatus,
} from "./openclaw-onboarding.js";
import type { OpenClawUiService } from "./types.js";

describe("resolveOpenClawOnboardingGatewayStatus", () => {
  it("preserves service method context when calling runOpenClaw", async () => {
    const service = {
      marker: "bound",
      runOpenClaw: async function (
        this: { marker: string },
        args: string[],
      ): Promise<{ code: number; stdout: string; stderr: string }> {
        if (this.marker !== "bound") {
          throw new Error("method context lost");
        }
        if (args[0] === "--version") {
          return {
            code: 0,
            stdout: "openclaw 1.2.3\n",
            stderr: "",
          };
        }
        return {
          code: 0,
          stdout: JSON.stringify({
            port: {
              status: "listening",
            },
          }),
          stderr: "",
        };
      },
    } as unknown as OpenClawUiService;

    const status = await resolveOpenClawOnboardingGatewayStatus(service);
    expect(status.installed).toBe(true);
    expect(status.gatewayRunning).toBe(true);
    expect(status.version).toBe("1.2.3");
  });

  it("treats busy port owned by openclaw-gateway as running", async () => {
    const service = {
      runOpenClaw: async (
        args: string[],
      ): Promise<{ code: number; stdout: string; stderr: string }> => {
        if (args[0] === "--version") {
          return {
            code: 0,
            stdout: "openclaw 1.2.3\n",
            stderr: "",
          };
        }
        return {
          code: 0,
          stdout: JSON.stringify({
            port: {
              status: "busy",
              listeners: [
                {
                  command: "node",
                  commandLine: "openclaw-gateway",
                },
              ],
              hints: [
                "Gateway already running locally. Stop it (openclaw gateway stop) or use a different port.",
              ],
            },
          }),
          stderr: "",
        };
      },
    } as unknown as OpenClawUiService;

    const status = await resolveOpenClawOnboardingGatewayStatus(service);
    expect(status.installed).toBe(true);
    expect(status.gatewayRunning).toBe(true);
  });
});
