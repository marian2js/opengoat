import assert from "node:assert/strict";
import test from "node:test";
import { createSpecialistRoutes } from "./specialists.ts";

void test("GET / returns 200 with specialist roster", async () => {
  const app = createSpecialistRoutes();

  const response = await app.request("/");
  assert.equal(response.status, 200);

  const data = (await response.json()) as {
    specialists: Array<{
      id: string;
      name: string;
      role: string;
      description: string;
      reasonToExist: string;
      outputTypes: string[];
      icon: string;
      category: string;
      instructionTemplate: string;
    }>;
  };

  assert.ok(Array.isArray(data.specialists), "Expected specialists array");
  assert.equal(data.specialists.length, 8, "Expected exactly 8 specialists");
});

void test("GET / response contains all required fields for each specialist", async () => {
  const app = createSpecialistRoutes();

  const response = await app.request("/");
  assert.equal(response.status, 200);

  const data = (await response.json()) as {
    specialists: Array<Record<string, unknown>>;
  };

  const requiredFields = [
    "id",
    "name",
    "role",
    "description",
    "reasonToExist",
    "outputTypes",
    "icon",
    "category",
    "instructionTemplate",
  ];

  for (const specialist of data.specialists) {
    for (const field of requiredFields) {
      assert.ok(
        specialist[field] !== undefined && specialist[field] !== null && specialist[field] !== "",
        `Expected specialist to have non-empty "${field}", got ${JSON.stringify(specialist[field])}`,
      );
    }
  }
});

void test("GET / response validates against specialistRosterSchema", async () => {
  // Dynamic import to avoid requiring contracts to be a node:test dep
  const { specialistRosterSchema } = await import("@opengoat/contracts");
  const app = createSpecialistRoutes();

  const response = await app.request("/");
  const data = await response.json();
  const result = specialistRosterSchema.safeParse(data);
  assert.ok(result.success, `Schema validation failed: ${JSON.stringify(result.error?.issues)}`);
});
