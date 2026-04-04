import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import {
  detectSections,
  matchHeadingToOutputType,
  mapOutputTypeToArtifactType,
  extractArtifacts,
  type ExtractionContext,
} from "../../packages/sidecar/src/artifact-extractor/index.ts";
import { createArtifactRoutes } from "../../packages/sidecar/src/server/routes/artifacts.ts";
import type { SidecarRuntime } from "../../packages/sidecar/src/server/context.ts";

// ---------------------------------------------------------------------------
// content-detector: detectSections
// ---------------------------------------------------------------------------
describe("detectSections", () => {
  it("splits markdown into sections by ## headings", () => {
    const md = `Some intro text

## Hero Rewrite Options

Here are three hero rewrite options for your landing page:

1. **Option A** — "Ship faster with AI-powered workflows"
2. **Option B** — "Your team's second brain for shipping"
3. **Option C** — "From idea to production in minutes"

## CTA Options

- Start free trial
- Book a demo
- See it in action
`;
    const sections = detectSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("Hero Rewrite Options");
    expect(sections[0].content).toContain("Option A");
    expect(sections[1].heading).toBe("CTA Options");
    expect(sections[1].content).toContain("Start free trial");
  });

  it("skips sections with less than 50 chars of body content", () => {
    const md = `## Good Section

This section has enough content to be considered a valid artifact with structured data and meaningful output.

## Too Short

Nope.
`;
    const sections = detectSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("Good Section");
  });

  it("returns empty array for markdown without ## headings", () => {
    const md = "Just a plain paragraph with no headings at all.";
    const sections = detectSections(md);
    expect(sections).toHaveLength(0);
  });

  it("handles multiple consecutive headings", () => {
    const md = `## Section One

Content for section one with enough text to pass the threshold easily here.

## Section Two

Content for section two with enough text to pass the threshold easily here.

## Section Three

Content for section three with enough text to pass the threshold easily here.
`;
    const sections = detectSections(md);
    expect(sections).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// content-detector: matchHeadingToOutputType
// ---------------------------------------------------------------------------
describe("matchHeadingToOutputType", () => {
  it("matches exact heading to outputType", () => {
    const outputTypes = ["competitor messaging matrix", "community shortlist"];
    const result = matchHeadingToOutputType("Competitor Messaging Matrix", outputTypes);
    expect(result).toBe("competitor messaging matrix");
  });

  it("matches fuzzy heading with keyword overlap", () => {
    const outputTypes = ["hero rewrite bundle", "CTA options", "trust/proof suggestions"];
    const result = matchHeadingToOutputType("Hero Rewrite Options", outputTypes);
    expect(result).toBe("hero rewrite bundle");
  });

  it("returns null when no match found", () => {
    const outputTypes = ["competitor messaging matrix", "community shortlist"];
    const result = matchHeadingToOutputType("Random Unrelated Heading", outputTypes);
    expect(result).toBeNull();
  });

  it("matches cold email sequence heading", () => {
    const outputTypes = ["cold email sequences", "subject lines", "segment-angle maps"];
    const result = matchHeadingToOutputType("Cold Email Sequence", outputTypes);
    expect(result).toBe("cold email sequences");
  });

  it("matches content ideas heading", () => {
    const outputTypes = ["content ideas", "post outlines", "editorial briefs"];
    const result = matchHeadingToOutputType("Content Ideas for Your Blog", outputTypes);
    expect(result).toBe("content ideas");
  });
});

// ---------------------------------------------------------------------------
// output-type-mapper: mapOutputTypeToArtifactType
// ---------------------------------------------------------------------------
describe("mapOutputTypeToArtifactType", () => {
  it("maps competitor messaging matrix to matrix", () => {
    expect(mapOutputTypeToArtifactType("competitor messaging matrix")).toBe("matrix");
  });

  it("maps hero rewrite bundle to copy_draft", () => {
    expect(mapOutputTypeToArtifactType("hero rewrite bundle")).toBe("copy_draft");
  });

  it("maps cold email sequences to email_sequence", () => {
    expect(mapOutputTypeToArtifactType("cold email sequences")).toBe("email_sequence");
  });

  it("maps Product Hunt launch pack to launch_pack", () => {
    expect(mapOutputTypeToArtifactType("Product Hunt launch pack")).toBe("launch_pack");
  });

  it("maps content ideas to dataset_list", () => {
    expect(mapOutputTypeToArtifactType("content ideas")).toBe("dataset_list");
  });

  it("maps launch checklist to checklist", () => {
    expect(mapOutputTypeToArtifactType("launch checklist")).toBe("checklist");
  });

  it("maps editorial briefs to research_brief", () => {
    expect(mapOutputTypeToArtifactType("editorial briefs")).toBe("research_brief");
  });

  it("maps post outlines to page_outline", () => {
    expect(mapOutputTypeToArtifactType("post outlines")).toBe("page_outline");
  });

  it("maps repurposing plans to content_calendar", () => {
    expect(mapOutputTypeToArtifactType("repurposing plans")).toBe("content_calendar");
  });

  it("maps launch sequencing plan to content_calendar", () => {
    expect(mapOutputTypeToArtifactType("launch sequencing plan")).toBe("content_calendar");
  });

  it("returns null for unknown output types", () => {
    expect(mapOutputTypeToArtifactType("something unknown")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractArtifacts: end-to-end with mocked ArtifactService
// ---------------------------------------------------------------------------
describe("extractArtifacts", () => {
  function createMockDeps() {
    const createdArtifacts: unknown[] = [];
    const artifactService = {
      createArtifact: vi.fn().mockImplementation((_paths: unknown, opts: unknown) => {
        const record = { artifactId: `art-${createdArtifacts.length + 1}`, ...(opts as object) };
        createdArtifacts.push(record);
        return Promise.resolve(record);
      }),
    };
    const opengoatPaths = { homeDir: "/tmp/test" };
    return { artifactService, opengoatPaths, createdArtifacts };
  }

  const baseContext: ExtractionContext = {
    specialistId: "website-conversion",
    agentId: "proj-1",
    sessionId: "sess-1",
    messageIndex: 3,
  };

  // Pattern 1: Hero rewrite (Website Conversion)
  it("extracts hero rewrite as copy_draft from Website Conversion response", async () => {
    const { artifactService, opengoatPaths } = createMockDeps();
    const text = `Great! Based on your product and ICP, here are my recommendations:

## Hero Rewrite Options

Here are three hero rewrite options for your landing page:

1. **Option A** — "Ship faster with AI-powered workflows"
2. **Option B** — "Your team's second brain for shipping"
3. **Option C** — "From idea to production in minutes"

Each option targets your developer ICP with action-oriented language.
`;

    const specialist = {
      id: "website-conversion",
      outputTypes: ["hero rewrite bundle", "CTA options", "trust/proof suggestions", "page-level recommendations", "landing-page improvements"],
    };

    const result = await extractArtifacts(text, baseContext, {
      artifactService: artifactService as any,
      opengoatPaths: opengoatPaths as any,
      specialist: specialist as any,
    });

    expect(result.artifacts).toHaveLength(1);
    expect(artifactService.createArtifact).toHaveBeenCalledTimes(1);
    const callArgs = artifactService.createArtifact.mock.calls[0][1];
    expect(callArgs.type).toBe("copy_draft");
    expect(callArgs.createdBy).toBe("website-conversion");
    expect(callArgs.projectId).toBe("proj-1");
    expect(callArgs.format).toBe("markdown");
    expect(callArgs.contentRef).toBe("chat://sess-1/3");
    expect(callArgs.title).toBe("Hero Rewrite Options");
  });

  // Pattern 2: Email sequence (Outbound)
  it("extracts cold email sequence as email_sequence from Outbound response", async () => {
    const { artifactService, opengoatPaths } = createMockDeps();
    const text = `Here's a cold email sequence targeting your developer ICP:

## Cold Email Sequence

**Email 1 — Introduction**
Subject: Quick question about [pain point]
Body: Hi {{firstName}}, I noticed your team uses [competitor]...

**Email 2 — Value Add**
Subject: How [company] cut deploy time by 40%
Body: {{firstName}}, thought you'd find this relevant...

**Email 3 — Break-up**
Subject: Should I close your file?
Body: Hi {{firstName}}, I've reached out a couple times...
`;

    const specialist = {
      id: "outbound",
      outputTypes: ["cold email sequences", "subject lines", "segment-angle maps", "founder outreach drafts", "partnership outreach drafts"],
    };

    const result = await extractArtifacts(text, {
      ...baseContext,
      specialistId: "outbound",
    }, {
      artifactService: artifactService as any,
      opengoatPaths: opengoatPaths as any,
      specialist: specialist as any,
    });

    expect(result.artifacts).toHaveLength(1);
    const callArgs = artifactService.createArtifact.mock.calls[0][1];
    expect(callArgs.type).toBe("email_sequence");
    expect(callArgs.createdBy).toBe("outbound");
    expect(callArgs.title).toBe("Cold Email Sequence");
  });

  // Pattern 3: Competitor matrix (Market Intel)
  it("extracts competitor messaging matrix as matrix from Market Intel response", async () => {
    const { artifactService, opengoatPaths } = createMockDeps();
    const text = `After analyzing your competitor landscape, here are my findings:

## Competitor Messaging Matrix

| Competitor | Positioning | Key Claim | Weakness |
|---|---|---|---|
| Acme Corp | "All-in-one platform" | Speed | No customization |
| Beta Inc | "Enterprise-grade" | Security | Expensive |
| Gamma Co | "Developer-first" | DX | Limited integrations |

Key gaps: None of your competitors emphasize the "AI-native" angle.

## Community Shortlist

1. **Hacker News** — High developer density, good for launches
2. **Reddit r/SaaS** — Active founder community
3. **IndieHackers** — Early adopter audience
4. **Dev.to** — Technical content distribution
`;

    const specialist = {
      id: "market-intel",
      outputTypes: ["competitor messaging matrix", "community shortlist", "customer-language themes", "market brief", "launch-surface recommendations"],
    };

    const result = await extractArtifacts(text, {
      ...baseContext,
      specialistId: "market-intel",
    }, {
      artifactService: artifactService as any,
      opengoatPaths: opengoatPaths as any,
      specialist: specialist as any,
    });

    // Should extract both sections
    expect(result.artifacts).toHaveLength(2);
    expect(artifactService.createArtifact).toHaveBeenCalledTimes(2);

    const firstCall = artifactService.createArtifact.mock.calls[0][1];
    expect(firstCall.type).toBe("matrix");
    expect(firstCall.title).toBe("Competitor Messaging Matrix");

    const secondCall = artifactService.createArtifact.mock.calls[1][1];
    expect(secondCall.type).toBe("dataset_list");
    expect(secondCall.title).toBe("Community Shortlist");
  });

  // Edge case: no extractable sections
  it("returns empty result when response has no extractable sections", async () => {
    const { artifactService, opengoatPaths } = createMockDeps();
    const text = "Sure, I can help with that. What specific aspects of your marketing would you like to focus on?";

    const specialist = {
      id: "cmo",
      outputTypes: ["prioritized recommendations", "cross-functional plans"],
    };

    const result = await extractArtifacts(text, {
      ...baseContext,
      specialistId: "cmo",
    }, {
      artifactService: artifactService as any,
      opengoatPaths: opengoatPaths as any,
      specialist: specialist as any,
    });

    expect(result.artifacts).toHaveLength(0);
    expect(result.skipped).toBe(0);
    expect(artifactService.createArtifact).not.toHaveBeenCalled();
  });

  // Edge case: sections below content threshold are skipped
  it("skips sections below content threshold", async () => {
    const { artifactService, opengoatPaths } = createMockDeps();
    const text = `## Hero Rewrite Options

Short.

## CTA Options

Here are several CTA options for your landing page that target different conversion goals and user intents:

- **Primary CTA**: "Start building for free" — Direct, low-friction
- **Secondary CTA**: "See it in action" — For evaluation-stage visitors
- **Tertiary CTA**: "Talk to a human" — For enterprise leads
`;

    const specialist = {
      id: "website-conversion",
      outputTypes: ["hero rewrite bundle", "CTA options", "trust/proof suggestions"],
    };

    const result = await extractArtifacts(text, baseContext, {
      artifactService: artifactService as any,
      opengoatPaths: opengoatPaths as any,
      specialist: specialist as any,
    });

    expect(result.artifacts).toHaveLength(1);
    const callArgs = artifactService.createArtifact.mock.calls[0][1];
    expect(callArgs.title).toBe("CTA Options");
    expect(callArgs.type).toBe("copy_draft");
  });

  // Edge case: default messageIndex
  it("uses messageIndex 0 when not provided", async () => {
    const { artifactService, opengoatPaths } = createMockDeps();
    const text = `## Launch Checklist

Here's your comprehensive launch checklist:

- [ ] Set up Product Hunt page
- [ ] Prepare social media posts
- [ ] Line up beta testers for upvotes
- [ ] Draft Show HN post
- [ ] Schedule email blast
`;

    const specialist = {
      id: "distribution",
      outputTypes: ["Product Hunt launch pack", "launch checklist", "community-post angles", "channel recommendations", "launch sequencing plan"],
    };

    const result = await extractArtifacts(text, {
      specialistId: "distribution",
      agentId: "proj-1",
      sessionId: "sess-2",
      // no messageIndex
    }, {
      artifactService: artifactService as any,
      opengoatPaths: opengoatPaths as any,
      specialist: specialist as any,
    });

    expect(result.artifacts).toHaveLength(1);
    const callArgs = artifactService.createArtifact.mock.calls[0][1];
    expect(callArgs.contentRef).toBe("chat://sess-2/0");
    expect(callArgs.type).toBe("checklist");
  });
});

// ---------------------------------------------------------------------------
// Manual extraction route: POST /extract
// ---------------------------------------------------------------------------
describe("POST /artifacts/extract", () => {
  function createMockRuntime() {
    const mockCreateArtifact = vi.fn().mockImplementation((_paths: unknown, opts: unknown) => {
      return Promise.resolve({ artifactId: "art-new", ...(opts as object) });
    });

    const mockBootstrap = vi.fn().mockResolvedValue({
      messages: [
        { id: "msg-0", role: "user", text: "Analyze my competitors" },
        {
          id: "msg-1",
          role: "assistant",
          text: `Here's the analysis:

## Competitor Messaging Matrix

| Competitor | Positioning | Key Claim |
|---|---|---|
| Acme | All-in-one | Speed |
| Beta | Enterprise | Security |

The key takeaway is that none of them focus on AI-native.`,
        },
      ],
      agent: { id: "goat", name: "Goat" },
      agents: [],
      session: { sessionKey: "sk-1" },
    });

    const runtime = {
      opengoatPaths: { homeDir: "/tmp/test" },
      artifactService: {
        createArtifact: mockCreateArtifact,
        listArtifacts: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        getArtifact: vi.fn(),
        getVersionHistory: vi.fn(),
        updateArtifact: vi.fn(),
        updateArtifactStatus: vi.fn(),
        createBundle: vi.fn(),
        listBundleArtifacts: vi.fn(),
      },
      embeddedGateway: {
        bootstrapConversation: mockBootstrap,
        streamConversation: vi.fn(),
      },
    } as unknown as SidecarRuntime;

    return { runtime, mockCreateArtifact, mockBootstrap };
  }

  it("extracts artifacts from a specified session message", async () => {
    const { runtime, mockCreateArtifact, mockBootstrap } = createMockRuntime();
    const app = new Hono();
    app.route("/artifacts", createArtifactRoutes(runtime));

    const res = await app.request("/artifacts/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess-1",
        messageIndex: 1,
        specialistId: "market-intel",
        agentId: "proj-1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artifacts).toHaveLength(1);
    expect(mockBootstrap).toHaveBeenCalledWith("proj-1", "sess-1");
    expect(mockCreateArtifact).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when message index is out of bounds", async () => {
    const { runtime } = createMockRuntime();
    const app = new Hono();
    app.route("/artifacts", createArtifactRoutes(runtime));

    const res = await app.request("/artifacts/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess-1",
        messageIndex: 99,
        specialistId: "market-intel",
        agentId: "proj-1",
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when message at index is not from assistant", async () => {
    const { runtime } = createMockRuntime();
    const app = new Hono();
    app.route("/artifacts", createArtifactRoutes(runtime));

    const res = await app.request("/artifacts/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "sess-1",
        messageIndex: 0, // user message
        specialistId: "market-intel",
        agentId: "proj-1",
      }),
    });

    expect(res.status).toBe(400);
  });
});
