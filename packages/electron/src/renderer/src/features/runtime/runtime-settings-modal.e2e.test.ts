/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkbenchGatewayMode } from "@shared/workbench";
import { RuntimeSettingsModal } from "./runtime-settings-modal";

afterEach(() => {
  cleanup();
});

describe("RuntimeSettingsModal e2e", () => {
  it("requires URL when switching to remote runtime", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    function StatefulHarness() {
      const [gateway, setGateway] = useState({
        mode: "local" as WorkbenchGatewayMode,
        remoteUrl: "",
        remoteToken: "",
        timeoutMs: 10_000
      });

      return createElement(RuntimeSettingsModal, {
        open: true,
        gateway,
        error: null,
        disabled: false,
        isSaving: false,
        onOpenChange: vi.fn(),
        onGatewayChange: (patch) =>
          setGateway((current) => ({
            ...current,
            ...patch
          })),
        onSave
      });
    }

    render(createElement(StatefulHarness));

    await user.click(screen.getByLabelText(/connect to remote opengoat/i));
    const saveButton = screen.getByRole("button", { name: /^save$/i });
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    await user.type(
      screen.getByPlaceholderText("ws://remote-host:18789/gateway"),
      "ws://remote-host:18789/gateway"
    );
    expect(saveButton.hasAttribute("disabled")).toBe(false);

    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
