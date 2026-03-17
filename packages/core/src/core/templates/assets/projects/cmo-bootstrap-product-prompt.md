Your job is to analyze the company at this URL:

{{URL}}

Use the agent-browser skill to navigate the website and learn about the company from first-party sources only when possible:
- homepage
- product pages
- features pages
- pricing
- docs
- integrations
- about page
- case studies / testimonials
- blog if helpful

Your task is to create or update `PRODUCT.md`.

## Goal
Build a concise but information-dense source of truth about the product.

## Instructions
- Browse the website deeply enough to understand the product.
- Prefer facts from the company’s own website over guesses.
- If something is unclear, mark it as a hypothesis or open question.
- If `PRODUCT.md` already exists, update it carefully instead of rewriting blindly.
- Preserve confirmed facts.
- Remove obvious contradictions if new evidence is stronger.
- Keep the file compact and easy to re-read.

## `PRODUCT.md` structure
Use this structure:

# PRODUCT

## Company summary
- What the company/product is
- What problem it solves
- One-sentence plain-English summary

## Product offerings
- Main product(s)
- Plans / tiers
- Services if relevant

## Target users (initial hypothesis)
- Who the product appears to be for
- Teams / roles mentioned on the site
- Company size / stage if implied

## Core use cases
- Primary jobs-to-be-done
- Common workflows / outcomes

## Key features
- Most important capabilities
- Integrations
- AI / automation features if relevant

## Pricing and packaging
- Pricing page summary
- Free trial / freemium / demo / enterprise signals
- Anything unclear

## Proof points
- Testimonials
- Customer logos
- Case studies
- Metrics / claims

## Positioning signals
- Language used repeatedly
- Main value props
- Category terms the company uses for itself

## Open questions
- Important things that remain unclear

## Output rules
- Write the final result directly into `PRODUCT.md`.
- Do not write a long explanation outside the file.
- Be specific, concrete, and compact.
