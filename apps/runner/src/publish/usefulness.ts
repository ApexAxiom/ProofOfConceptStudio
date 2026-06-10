import { BriefPost, matchEntities } from "@proof/shared";

/**
 * Usefulness checks for published briefs.
 *
 * The bar for a useful signal: it names someone (a supplier/operator or other
 * proper noun), contains something concrete (a number or date), and is not
 * generic filler. Unlike the old FACTCHECK regime these checks never block
 * publishing — they land in qualityReport.issues so weak briefs are visible
 * and measurable instead of silently replaced by fallbacks.
 */

const GENERIC_PHRASES = [
  /this matters for the category/i,
  /monitor the situation/i,
  /stay (?:alert|vigilant|informed)/i,
  /keep an eye on/i,
  /various (?:suppliers|factors|sources)/i,
  /it is worth noting/i,
  /in today'?s (?:dynamic|fast-paced|evolving) market/i
];

const MONTHS = /\b(january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|h[12]\s?20\d{2})\b/i;

function hasConcreteFigure(text: string): boolean {
  return /\d/.test(text) || MONTHS.test(text);
}

function hasProperNoun(text: string): boolean {
  // A capitalized token that is not sentence-initial — crude but effective
  // for catching "Valaris", "Gulf of Mexico", "NOPSEMA" mid-sentence.
  return /(?<![.!?]\s)(?<!^)\b[A-Z][A-Za-z&-]{2,}\b/.test(text.trim());
}

function isGeneric(text: string): boolean {
  return GENERIC_PHRASES.some((pattern) => pattern.test(text));
}

/**
 * Returns non-blocking usefulness issues for a brief. Empty array = clean.
 */
export function assessBriefUsefulness(brief: BriefPost): string[] {
  const issues: string[] = [];

  const namesEntity = (text: string): boolean => {
    if (matchEntities(text, brief.portfolio, brief.region).length > 0) return true;
    return hasProperNoun(text);
  };

  const summaryBullets = brief.report?.summaryBullets ?? [];
  summaryBullets.forEach((bullet, idx) => {
    const text = bullet.text ?? "";
    if (!text) return;
    if (isGeneric(text)) {
      issues.push(`usefulness: summary bullet ${idx + 1} is generic filler ("${text.slice(0, 60)}...")`);
      return;
    }
    if (!namesEntity(text) && !hasConcreteFigure(text)) {
      issues.push(`usefulness: summary bullet ${idx + 1} names no entity and has no concrete figure or date`);
    }
  });

  (brief.highlights ?? []).forEach((highlight, idx) => {
    if (isGeneric(highlight)) {
      issues.push(`usefulness: highlight ${idx + 1} is generic filler`);
    }
  });

  const actionGroups = brief.report?.actionGroups ?? [];
  actionGroups.forEach((group) => {
    group.actions.forEach((action, idx) => {
      const rationale = action.rationale ?? "";
      if (rationale && !/because/i.test(rationale)) {
        issues.push(`usefulness: action "${group.horizon}" #${idx + 1} rationale lacks a "because" trigger clause`);
      }
    });
  });

  (brief.selectedArticles ?? []).forEach((article, idx) => {
    const importance = article.categoryImportance ?? "";
    if (importance && isGeneric(importance)) {
      issues.push(`usefulness: article ${idx + 1} categoryImportance is generic filler`);
    }
  });

  return issues;
}
