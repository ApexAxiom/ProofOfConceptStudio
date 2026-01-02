/**
 * Centralized Writing Guide for AI Brief Generation
 * 
 * This file contains all writing rules and style guidelines that AI agents
 * must follow when generating briefs. Having a single source of truth allows
 * for quick, consistent adjustments across all categories.
 * 
 * MODIFICATION GUIDE:
 * - Adjust TONE settings to change overall voice
 * - Modify STRUCTURE rules to change brief format
 * - Update WORD_LIMITS to control length
 * - Edit FORBIDDEN_PATTERNS to block unwanted phrases
 */

export const WRITING_GUIDE = {
  // ============================================
  // TONE & VOICE
  // ============================================
  tone: {
    style: "Professional news wire",
    voice: "Active, authoritative, concise",
    perspective: "Third-person objective",
    examples: {
      good: [
        "Oil prices surged 5% as OPEC announced production cuts.",
        "The acquisition signals a major shift in subsea market dynamics.",
        "Contract delays threaten Q2 project timelines."
      ],
      bad: [
        "We think this is really interesting news.",
        "It's worth noting that prices went up.",
        "In this brief, we will discuss..."
      ]
    }
  },

  // ============================================
  // STRUCTURE RULES
  // ============================================
  structure: {
    headline: {
      rules: [
        "Lead with action or impact, never generic labels",
        "Include specific numbers when available",
        "Maximum 12 words",
        "No colons or question marks"
      ],
      goodExamples: [
        "LNG Spot Prices Surge 12% on Asian Demand Rebound",
        "Subsea Contractors Face Capacity Crunch Through 2026",
        "Baker Hughes Reports 8-Rig Weekly Decline in Permian"
      ],
      badExamples: [
        "Weekly Update on Drilling Services",
        "News from the Oil and Gas Sector",
        "What's Happening in Energy Markets?"
      ]
    },
    summary: {
      rules: [
        "Maximum 2 sentences",
        "Lead with the most actionable insight",
        "Include one specific data point",
        "End with relevance to procurement/category managers"
      ],
      maxWords: 50
    },
    articleBriefs: {
      rules: [
        "Each article gets its own section",
        "Lead with the key insight, not the source",
        "Include specific numbers and dates",
        "Explain 'so what' for category managers",
        "End with exact source article link"
      ],
      maxWordsPerArticle: 100
    }
  },

  // ============================================
  // WORD LIMITS
  // ============================================
  wordLimits: {
    headline: 12,
    summary: 50,
    perArticleBrief: 100,
    totalBrief: 400,
    bulletPoint: 25
  },

  // ============================================
  // POWER VERBS (Use these)
  // ============================================
  powerVerbs: [
    "surged", "plunged", "signals", "threatens", "secures",
    "expands", "delays", "targets", "reveals", "disrupts",
    "accelerates", "stalls", "launches", "acquires", "divests",
    "suspends", "resumes", "consolidates", "outpaces", "undercuts"
  ],

  // ============================================
  // FORBIDDEN PATTERNS (Never use)
  // ============================================
  forbiddenPatterns: [
    // Filler phrases
    "it is worth noting",
    "interestingly",
    "it should be noted",
    "as we all know",
    "needless to say",
    
    // Self-referential
    "in this brief",
    "this report covers",
    "we will discuss",
    "as mentioned earlier",
    "as stated above",
    
    // Weak openings
    "there is",
    "there are",
    "it is",
    "this is",
    
    // Vague language
    "various",
    "several",
    "many",
    "some",
    "a number of",
    "significant",
    
    // Duplicate phrases (same idea twice)
    "first and foremost",
    "each and every",
    "in order to",
    "at this point in time",
    "due to the fact that"
  ],

  // ============================================
  // CITATION RULES
  // ============================================
  citations: {
    rules: [
      "Every factual claim must cite its source",
      "Do NOT output URLs in JSON; reference sources by articleIndex only",
      "Use the provided articleIndex numbers when attributing facts",
      "Never invent, modify, or guess URLs"
    ],
    format: {
      inline: "(source: articleIndex #)",
      articleEnd: "Reference articleIndex numbers only"
    }
  },

  // ============================================
  // ARTICLE SELECTION CRITERIA
  // ============================================
  articleSelection: {
    prioritize: [
      "Breaking news with market impact",
      "Contract awards and deal announcements",
      "Price movements with specific percentages",
      "Regulatory changes affecting procurement",
      "Supply chain disruptions or delays",
      "Major company announcements"
    ],
    avoid: [
      "Opinion pieces without news value",
      "Outdated articles (>7 days old)",
      "Paywalled content with no extractable information",
      "Generic industry overviews",
      "Press releases with no actionable content"
    ],
    count: 3 // Always select exactly 3 articles per category
  },

  // ============================================
  // IMAGE SELECTION CRITERIA
  // ============================================
  imageSelection: {
    rules: [
      "Use the featured image from the primary article",
      "Prefer images with actual content (equipment, facilities, people)",
      "Avoid generic stock photos or logos",
      "Always link image back to its source article",
      "Include descriptive alt text"
    ],
    fallback: "Use image from most relevant of the 3 selected articles"
  }
} as const;

/**
 * Generates the writing instructions section for the LLM prompt
 */
export function getWritingInstructions(): string {
  return `
## WRITING STYLE GUIDE

### Tone & Voice
- Style: ${WRITING_GUIDE.tone.style}
- Voice: ${WRITING_GUIDE.tone.voice}
- Perspective: ${WRITING_GUIDE.tone.perspective}

### Headline Rules
${WRITING_GUIDE.structure.headline.rules.map((r) => `- ${r}`).join("\n")}

Good headlines:
${WRITING_GUIDE.structure.headline.goodExamples.map((e) => `✓ "${e}"`).join("\n")}

Bad headlines (NEVER write like this):
${WRITING_GUIDE.structure.headline.badExamples.map((e) => `✗ "${e}"`).join("\n")}

### Summary Rules
${WRITING_GUIDE.structure.summary.rules.map((r) => `- ${r}`).join("\n")}
- Maximum: ${WRITING_GUIDE.structure.summary.maxWords} words

### Article Brief Rules
${WRITING_GUIDE.structure.articleBriefs.rules.map((r) => `- ${r}`).join("\n")}
- Maximum: ${WRITING_GUIDE.wordLimits.perArticleBrief} words per article

### Power Verbs (Use These)
${WRITING_GUIDE.powerVerbs.join(", ")}

### Forbidden Phrases (NEVER Use)
${WRITING_GUIDE.forbiddenPatterns.map((p) => `- "${p}"`).join("\n")}

### Word Limits
- Headline: ${WRITING_GUIDE.wordLimits.headline} words max
- Summary: ${WRITING_GUIDE.wordLimits.summary} words max
- Per article: ${WRITING_GUIDE.wordLimits.perArticleBrief} words max
- Total brief: ${WRITING_GUIDE.wordLimits.totalBrief} words max
`.trim();
}

/**
 * Generates citation instructions for the LLM prompt
 */
export function getCitationInstructions(): string {
  return `
## CITATION REQUIREMENTS (CRITICAL)

${WRITING_GUIDE.citations.rules.map((r) => `- ${r}`).join("\n")}

### Citation Format
- Inline citation: ${WRITING_GUIDE.citations.format.inline}
- Article source: ${WRITING_GUIDE.citations.format.articleEnd}

### Article Selection
Select exactly ${WRITING_GUIDE.articleSelection.count} articles. Prioritize:
${WRITING_GUIDE.articleSelection.prioritize.map((p) => `- ${p}`).join("\n")}

Avoid:
${WRITING_GUIDE.articleSelection.avoid.map((a) => `- ${a}`).join("\n")}
`.trim();
}

/**
 * Generates image selection instructions for the LLM prompt
 */
export function getImageInstructions(): string {
  return `
## IMAGE SELECTION

${WRITING_GUIDE.imageSelection.rules.map((r) => `- ${r}`).join("\n")}
- Fallback: ${WRITING_GUIDE.imageSelection.fallback}
`.trim();
}

export type WritingGuide = typeof WRITING_GUIDE;
