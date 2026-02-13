import multiavatar from "@multiavatar/multiavatar/esm";
import ceoAvatarImage from "../../../../../assets/opengoat.png";

const MULTIAVATAR_API_BASE_URL = "https://api.multiavatar.com";
const CEO_AGENT_ID = "ceo";

export interface AgentAvatarSource {
  src: string;
  fallbackSrc: string | null;
}

export function resolveAgentAvatarSource(agentId: string): AgentAvatarSource {
  const normalizedAgentId = agentId.trim();
  if (normalizedAgentId.toLowerCase() === CEO_AGENT_ID) {
    return {
      src: ceoAvatarImage,
      fallbackSrc: null,
    };
  }

  const seed = normalizedAgentId || agentId;
  const remoteSrc = `${MULTIAVATAR_API_BASE_URL}/${encodeURIComponent(seed)}.svg`;
  const fallbackSvg = multiavatar(seed);
  const fallbackSrc = `data:image/svg+xml;utf8,${encodeURIComponent(fallbackSvg)}`;

  return {
    src: remoteSrc,
    fallbackSrc,
  };
}
