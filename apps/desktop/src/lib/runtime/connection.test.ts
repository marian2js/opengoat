import assert from "node:assert/strict";
import test from "node:test";
import { resolveBrowserDevConnection } from "./connection";

void test("resolveBrowserDevConnection returns a dev browser connection", () => {
  const connection = resolveBrowserDevConnection(
    {
      DEV: true,
      VITE_OPENGOAT_BROWSER_SIDECAR_PASSWORD: "dev-secret",
      VITE_OPENGOAT_BROWSER_SIDECAR_URL: "http://127.0.0.1:19110",
      VITE_OPENGOAT_BROWSER_SIDECAR_USERNAME: "opengoat",
    },
    false,
  );

  assert.deepEqual(connection, {
    isSidecar: true,
    password: "dev-secret",
    url: "http://127.0.0.1:19110",
    username: "opengoat",
  });
});

void test("resolveBrowserDevConnection falls back to proxy URL when no sidecar URL is set", () => {
  const connection = resolveBrowserDevConnection(
    {
      DEV: true,
      VITE_OPENGOAT_BROWSER_SIDECAR_PASSWORD: "dev-secret",
      VITE_OPENGOAT_BROWSER_SIDECAR_USERNAME: "opengoat",
    },
    false,
  );

  assert.ok(connection);
  assert.equal(connection.username, "opengoat");
  assert.equal(connection.password, "dev-secret");
  assert.ok(
    connection.url.startsWith("http"),
    "Falls back to an HTTP origin when no explicit sidecar URL is provided",
  );
});

void test("resolveBrowserDevConnection stays disabled outside browser dev mode", () => {
  assert.equal(
    resolveBrowserDevConnection(
      {
        DEV: false,
      },
      false,
    ),
    null,
  );

  assert.equal(
    resolveBrowserDevConnection(
      {
        DEV: true,
      },
      true,
    ),
    null,
  );
});
