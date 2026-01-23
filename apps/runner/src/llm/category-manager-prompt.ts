/**
 * Category Manager AI Agent Prompt System
 * 
 * Each agent is an expert Category Management Analyst who writes daily intelligence
 * briefs specifically for their category. The briefs are fact-based, analytical, and
 * focused on keeping Category Managers informed about their specific market segment
 * while providing broader industry context (Oil, Gas, LNG).
 * 
 * WRITING PHILOSOPHY:
 * - Think like a procurement analyst writing for busy category managers
 * - Lead with what matters to sourcing decisions
 * - Numbers and facts over opinions
 * - Industry context supports category-specific insights
 * - Every brief should answer: "What does this mean for my category?"
 */

import { AgentConfig, RegionSlug, buildAgentSystemPrompt, getAgentFramework } from "@proof/shared";

/**
 * Category-specific context that helps the AI understand what matters for each portfolio
 */
/**
 * Builds the Category Manager persona for the prompt
 */
export function getCategoryManagerPersona(agent: AgentConfig, region: RegionSlug): string {
  return buildAgentSystemPrompt(agent, region);
}

/**
 * Gets the category-specific article selection guidance
 */
export function getCategorySelectionGuidance(agent: AgentConfig): string {
  const context = getAgentFramework(agent.id);
  
  return `
## ARTICLE SELECTION FOR ${agent.label.toUpperCase()}

Prioritize articles that address:
${context.focusAreas.map(f => `- ${f}`).join("\n")}

Look for mentions of key suppliers:
${context.keySuppliers.length > 0 ? context.keySuppliers.slice(0, 5).join(", ") : "N/A"}

Consider market drivers:
${context.marketDrivers.map(d => `- ${d}`).join("\n")}

### Sourcing Relevance Test
For each article, ask: "Would a Category Manager for ${agent.label} need to know this for:
- Supplier negotiations?
- Budget planning?
- Risk management?
- Market intelligence?"

If the answer is no to all, skip the article.
`.trim();
}

/**
 * Gets the brief structure requirements for Category Management briefs
 */
export function getCategoryBriefStructure(): string {
  return `
## BRIEF STRUCTURE

Your daily intelligence brief must follow this structure:

### 1. Headline (max 12 words)
- Lead with the most significant development
- Use numbers only when explicitly present in evidence
- Format: "[Subject] [Action] [Impact/Number]"
- Example: "Rig Day Rates Surge 15% as Gulf Demand Outpaces Supply"

### 2. Executive Summary (max 70 words)
- One-paragraph overview for busy executives
- Must answer: What happened? Why does it matter? What's next?
- Include a key number only if evidence-backed; otherwise write without numbers
- Include one sentence of expert implication tagged (analysis)

### 3. Article Briefs (1-3 articles, ~140 words each)
For each selected article, provide:

**briefContent** (140 words):
- Lead sentence with the key fact; use numbers only if evidence-backed
- Context about why this matters for the category  
- Supplier impact showing how this affects key suppliers or supply market
- Market dynamics and what to monitor
- Add 1-2 sentences of expert interpretation tagged (analysis)

**categoryImportance** (1-2 sentences):
- Direct, actionable insight for category managers
- Start with "This signals..." or "Monitor this because..." or "Consider..."
- Connect the news directly to procurement decisions or supplier negotiations

**keyMetrics** (2-4 data points):
- Extract numbers only when explicitly present in evidence excerpts
- Format as concise strings: "$72/bbl", "+15% YoY", "Q2 2025", "3.2M barrels"

### 4. Market Indicators
- Select 2-3 most relevant indices for this category
- Add one-sentence context for each: "WTI at $72/bbl supports drilling activity, positive for rig demand"
`.trim();
}
