import { isDiscoverableByManager, isDirectReport, isManagerAgent, type AgentManifest } from "../../agents/index.js";
import type { RoutingCandidate, RoutingDecision } from "../domain/routing.js";

interface RoutingServiceInput {
  entryAgentId: string;
  message: string;
  manifests: AgentManifest[];
}

export class RoutingService {
  public decide(input: RoutingServiceInput): RoutingDecision {
    const entryAgentId = input.entryAgentId.trim().toLowerCase();
    const message = input.message.trim();
    const entryManifest = input.manifests.find((manifest) => manifest.agentId === entryAgentId);

    if (!message) {
      return {
        entryAgentId,
        targetAgentId: entryAgentId,
        confidence: 1,
        reason: "Empty message; keeping current agent.",
        rewrittenMessage: message,
        candidates: []
      };
    }

    const canDelegate = Boolean(entryManifest && isManagerAgent(entryManifest));
    if (!canDelegate) {
      return {
        entryAgentId,
        targetAgentId: entryAgentId,
        confidence: 1,
        reason: "Entry agent is not a manager (missing manager skill).",
        rewrittenMessage: message,
        candidates: []
      };
    }

    const candidates = input.manifests
      .filter((manifest) => manifest.agentId !== entryAgentId)
      .filter((manifest) => isDirectReport(manifest, entryAgentId))
      .filter((manifest) => isDiscoverableByManager(manifest))
      .map((manifest) => scoreCandidate(message, manifest))
      .sort((left, right) => right.score - left.score);

    const top = candidates[0];
    if (!top || top.score <= 0) {
      return {
        entryAgentId,
        targetAgentId: entryAgentId,
        confidence: 0.35,
        reason: "No direct-report agent strongly matched the request.",
        rewrittenMessage: message,
        candidates
      };
    }

    const tokenCount = tokenize(message).length;
    const confidence = Number(Math.min(0.99, top.score / Math.max(4, tokenCount + 1)).toFixed(2));
    const reason = `Matched ${top.matchedTerms.length} relevant term(s) for ${top.agentName}.`;

    return {
      entryAgentId,
      targetAgentId: top.agentId,
      confidence,
      reason,
      rewrittenMessage: rewriteMessageForDelegation(message, top.agentName, reason),
      candidates
    };
  }
}

function scoreCandidate(message: string, manifest: AgentManifest): RoutingCandidate {
  const messageTokens = tokenize(message);
  const metadataTokens = tokenize(
    [manifest.metadata.id, manifest.metadata.name, manifest.metadata.description, ...manifest.metadata.tags].join(" ")
  );
  const bodyTokens = tokenize(manifest.body).slice(0, 80);

  const matchedTerms = intersect(messageTokens, new Set([...metadataTokens, ...bodyTokens]));
  const explicitNameMatch = includesExactWord(message, manifest.metadata.id) || includesExactWord(message, manifest.metadata.name);

  const relevanceScore = matchedTerms.length * 2 + (explicitNameMatch ? 4 : 0);
  const priorityBoost = relevanceScore > 0 ? Math.max(0, Math.min(3, manifest.metadata.priority / 50)) : 0;
  const score = relevanceScore + priorityBoost;
  const reason = explicitNameMatch
    ? `Explicit mention and ${matchedTerms.length} matched metadata terms.`
    : `${matchedTerms.length} matched metadata terms.`;

  return {
    agentId: manifest.agentId,
    agentName: manifest.metadata.name,
    score: Number(score.toFixed(2)),
    matchedTerms: matchedTerms.slice(0, 8),
    reason
  };
}

function rewriteMessageForDelegation(message: string, agentName: string, reason: string): string {
  return [
    `Original user request:\n${message}`,
    `Delegation target: ${agentName}`,
    `Delegation reason: ${reason}`,
    "Please execute the task and return a concise, user-ready response."
  ].join("\n\n");
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function intersect(left: Iterable<string>, right: Set<string>): string[] {
  const matches: string[] = [];
  for (const token of left) {
    if (right.has(token) && !matches.includes(token)) {
      matches.push(token);
    }
  }
  return matches;
}

function includesExactWord(haystack: string, needle: string): boolean {
  if (!needle.trim()) {
    return false;
  }

  const escaped = needle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return pattern.test(haystack);
}
