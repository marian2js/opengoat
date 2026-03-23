import type { PlaybookManifest } from "../domain/playbook.js";
import { launchPackPlaybook } from "./launch-pack.js";
import { homepageConversionPlaybook } from "./homepage-conversion.js";
import { outboundStarterPlaybook } from "./outbound-starter.js";
import { seoWedgePlaybook } from "./seo-wedge.js";
import { contentSprintPlaybook } from "./content-sprint.js";
import { comparisonPagePlaybook } from "./comparison-page.js";
import { leadMagnetPlaybook } from "./lead-magnet.js";
import { onboardingActivationPlaybook } from "./onboarding-activation.js";

export const BUILTIN_PLAYBOOKS: ReadonlyArray<PlaybookManifest> = [
  launchPackPlaybook,
  homepageConversionPlaybook,
  outboundStarterPlaybook,
  seoWedgePlaybook,
  contentSprintPlaybook,
  comparisonPagePlaybook,
  leadMagnetPlaybook,
  onboardingActivationPlaybook,
];
