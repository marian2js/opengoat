import { describe, expect, it } from "vitest";
import {
  objectiveStatusSchema,
  objectiveCreatedFromSchema,
  objectiveSchema,
  createObjectiveRequestSchema,
  updateObjectiveRequestSchema,
  listObjectivesQuerySchema,
  archiveObjectiveRequestSchema,
  objectiveListSchema,
} from "../../packages/contracts/src/index.js";
import type {
  ObjectiveRecord,
  CreateObjectiveOptions,
  UpdateObjectiveOptions,
  ListObjectivesOptions,
} from "../../packages/core/src/core/objectives/index.js";

// ---------- Zod schema tests ----------

describe("objectiveStatusSchema", () => {
  it("accepts all valid statuses", () => {
    for (const s of ["draft", "active", "paused", "completed", "abandoned"]) {
      expect(objectiveStatusSchema.parse(s)).toBe(s);
    }
  });

  it("rejects invalid status", () => {
    expect(() => objectiveStatusSchema.parse("unknown")).toThrow();
  });
});

describe("objectiveCreatedFromSchema", () => {
  it("accepts all valid sources", () => {
    for (const s of ["dashboard", "chat", "action", "manual", "signal"]) {
      expect(objectiveCreatedFromSchema.parse(s)).toBe(s);
    }
  });

  it("rejects invalid source", () => {
    expect(() => objectiveCreatedFromSchema.parse("api")).toThrow();
  });
});

describe("objectiveSchema", () => {
  const validObjective = {
    objectiveId: "obj-1",
    projectId: "proj-1",
    title: "Launch on Product Hunt",
    goalType: "launch",
    status: "active",
    summary: "Launch the product on Product Hunt next week",
    createdFrom: "dashboard",
    isPrimary: true,
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  };

  it("parses a valid full objective", () => {
    const result = objectiveSchema.parse(validObjective);
    expect(result.objectiveId).toBe("obj-1");
    expect(result.title).toBe("Launch on Product Hunt");
    expect(result.status).toBe("active");
    expect(result.isPrimary).toBe(true);
  });

  it("applies default false for isPrimary when not provided", () => {
    const { isPrimary: _, ...withoutPrimary } = validObjective;
    const result = objectiveSchema.parse(withoutPrimary);
    expect(result.isPrimary).toBe(false);
  });

  it("accepts optional fields", () => {
    const full = {
      ...validObjective,
      whyNow: "Time-sensitive launch window",
      successDefinition: "Top 5 on PH",
      timeframe: "1 week",
      alreadyTried: "Nothing yet",
      avoid: "Spammy outreach",
      constraints: "Budget under $500",
      preferredChannels: ["twitter", "reddit"],
      archivedAt: "2026-04-01T00:00:00Z",
    };
    const result = objectiveSchema.parse(full);
    expect(result.whyNow).toBe("Time-sensitive launch window");
    expect(result.preferredChannels).toEqual(["twitter", "reddit"]);
    expect(result.archivedAt).toBe("2026-04-01T00:00:00Z");
  });

  it("rejects when required fields are missing", () => {
    expect(() => objectiveSchema.parse({})).toThrow();
    expect(() => objectiveSchema.parse({ objectiveId: "x" })).toThrow();
  });

  it("rejects objectiveId with empty string", () => {
    expect(() => objectiveSchema.parse({ ...validObjective, objectiveId: "" })).toThrow();
  });

  it("allows empty summary string", () => {
    const result = objectiveSchema.parse({ ...validObjective, summary: "" });
    expect(result.summary).toBe("");
  });
});

describe("createObjectiveRequestSchema", () => {
  it("accepts title only", () => {
    const result = createObjectiveRequestSchema.parse({ title: "New goal" });
    expect(result.title).toBe("New goal");
  });

  it("accepts title with optional fields", () => {
    const result = createObjectiveRequestSchema.parse({
      title: "New goal",
      goalType: "growth",
      summary: "Grow user base",
      whyNow: "Q2 target",
      successDefinition: "1000 users",
      preferredChannels: ["seo"],
    });
    expect(result.goalType).toBe("growth");
    expect(result.preferredChannels).toEqual(["seo"]);
  });

  it("rejects missing title", () => {
    expect(() => createObjectiveRequestSchema.parse({})).toThrow();
  });

  it("rejects empty title", () => {
    expect(() => createObjectiveRequestSchema.parse({ title: "" })).toThrow();
  });
});

describe("updateObjectiveRequestSchema", () => {
  it("accepts empty object (no updates)", () => {
    const result = updateObjectiveRequestSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts partial updates", () => {
    const result = updateObjectiveRequestSchema.parse({
      title: "Updated title",
      status: "paused",
    });
    expect(result.title).toBe("Updated title");
    expect(result.status).toBe("paused");
  });

  it("rejects invalid status in update", () => {
    expect(() =>
      updateObjectiveRequestSchema.parse({ status: "invalid" }),
    ).toThrow();
  });
});

describe("listObjectivesQuerySchema", () => {
  it("requires projectId", () => {
    const result = listObjectivesQuerySchema.parse({ projectId: "proj-1" });
    expect(result.projectId).toBe("proj-1");
  });

  it("accepts optional status filter", () => {
    const result = listObjectivesQuerySchema.parse({
      projectId: "proj-1",
      status: "active",
    });
    expect(result.status).toBe("active");
  });

  it("rejects missing projectId", () => {
    expect(() => listObjectivesQuerySchema.parse({})).toThrow();
  });
});

describe("archiveObjectiveRequestSchema", () => {
  it("accepts empty object", () => {
    const result = archiveObjectiveRequestSchema.parse({});
    expect(result).toEqual({});
  });

  it("accepts optional reason", () => {
    const result = archiveObjectiveRequestSchema.parse({
      reason: "No longer relevant",
    });
    expect(result.reason).toBe("No longer relevant");
  });
});

describe("objectiveListSchema", () => {
  it("parses an array of objectives", () => {
    const objectives = [
      {
        objectiveId: "obj-1",
        projectId: "proj-1",
        title: "Goal 1",
        goalType: "launch",
        status: "active",
        summary: "",
        createdFrom: "dashboard",
        isPrimary: true,
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-01T00:00:00Z",
      },
      {
        objectiveId: "obj-2",
        projectId: "proj-1",
        title: "Goal 2",
        goalType: "growth",
        status: "draft",
        summary: "Grow",
        createdFrom: "chat",
        isPrimary: false,
        createdAt: "2026-03-02T00:00:00Z",
        updatedAt: "2026-03-02T00:00:00Z",
      },
    ];
    const result = objectiveListSchema.parse(objectives);
    expect(result).toHaveLength(2);
    expect(result[0].objectiveId).toBe("obj-1");
  });

  it("parses an empty array", () => {
    const result = objectiveListSchema.parse([]);
    expect(result).toHaveLength(0);
  });
});

// ---------- Domain type tests ----------

describe("Core domain types", () => {
  it("ObjectiveRecord matches the Zod schema shape", () => {
    const record: ObjectiveRecord = {
      objectiveId: "obj-1",
      projectId: "proj-1",
      title: "Launch",
      goalType: "launch",
      status: "active",
      summary: "",
      createdFrom: "dashboard",
      isPrimary: false,
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-01T00:00:00Z",
    };
    expect(record.objectiveId).toBe("obj-1");
  });

  it("ObjectiveRecord accepts optional fields", () => {
    const record: ObjectiveRecord = {
      objectiveId: "obj-1",
      projectId: "proj-1",
      title: "Launch",
      goalType: "launch",
      status: "active",
      summary: "",
      createdFrom: "dashboard",
      isPrimary: false,
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-01T00:00:00Z",
      whyNow: "Timing",
      successDefinition: "Top 5",
      timeframe: "1 week",
      alreadyTried: "Nothing",
      avoid: "Spam",
      constraints: "Budget",
      preferredChannels: ["twitter"],
      archivedAt: "2026-04-01T00:00:00Z",
    };
    expect(record.whyNow).toBe("Timing");
    expect(record.preferredChannels).toEqual(["twitter"]);
  });

  it("CreateObjectiveOptions requires only title", () => {
    const opts: CreateObjectiveOptions = {
      title: "New goal",
    };
    expect(opts.title).toBe("New goal");
  });

  it("UpdateObjectiveOptions allows all fields as optional", () => {
    const opts: UpdateObjectiveOptions = {
      title: "Changed",
      status: "paused",
    };
    expect(opts.title).toBe("Changed");
  });

  it("ListObjectivesOptions requires projectId", () => {
    const opts: ListObjectivesOptions = {
      projectId: "proj-1",
    };
    expect(opts.projectId).toBe("proj-1");
  });

  it("ListObjectivesOptions accepts optional status", () => {
    const opts: ListObjectivesOptions = {
      projectId: "proj-1",
      status: "active",
    };
    expect(opts.status).toBe("active");
  });
});
