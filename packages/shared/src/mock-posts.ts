import { BriefPost } from "./types.js";

/**
 * Curated fallback briefs used when live content sources are unavailable.
 */
export const MOCK_POSTS: BriefPost[] = [
  {
    postId: "rigs-au-001",
    title: "AU offshore rig demand lifted by new campaign awards",
    region: "au",
    portfolio: "rigs-integrated-drilling",
    runWindow: "apac",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Woodside and Santos sanctioned new well work, tightening jack-up availability.",
    bodyMarkdown:
      "Woodside and Santos sanctioned new 2025 well work off WA, lifting jack-up and semi demand across the North West Shelf.",
    sources: ["https://www.energytodaymag.com.au/"],
    heroImageUrl: "https://example.com/images/rigs-au.jpg",
    heroImageSourceUrl: "https://www.energytodaymag.com.au/",
    heroImageAlt: "Offshore rig in Australian waters",
    selectedArticles: [
      {
        title: "WA drilling campaigns advance",
        url: "https://www.energytodaymag.com.au/article",
        briefContent: "New tenders increase jack-up demand into 2025.",
        categoryImportance: "Tighter rigs drive higher dayrates for renewals.",
        sourceIndex: 1
      }
    ],
    vpSnapshot: {
      health: {
        overall: 72,
        costPressure: 65,
        supplyRisk: 55,
        scheduleRisk: 35,
        complianceRisk: 20,
        narrative: "Rig tightness keeps upward cost pressure on renewals."
      },
      topSignals: [
        {
          title: "Jack-up awards pull forward Q1 2025 demand",
          type: "supply",
          horizon: "30-180d",
          confidence: "medium",
          impact: "Higher utilisation narrows options for spot cover.",
          evidenceArticleIndex: 1
        }
      ],
      recommendedActions: [
        {
          action: "Lock renewal options with rate caps",
          ownerRole: "Contracts",
          dueInDays: 21,
          expectedImpact: "Protects exposure if dayrates keep rising.",
          confidence: "medium",
          evidenceArticleIndex: 1
        }
      ],
      riskRegister: [
        {
          risk: "Limited spot availability for Q1 wells",
          probability: "medium",
          impact: "high",
          mitigation: "Pre-book standby coverage with extension clauses.",
          trigger: "Operators announce incremental wells",
          horizon: "0-30d",
          evidenceArticleIndex: 1
        }
      ]
    }
  },
  {
    postId: "rigs-us-001",
    title: "US Gulf drilling stabilizes as operators finalize 2025 programs",
    region: "us-mx-la-lng",
    portfolio: "rigs-integrated-drilling",
    runWindow: "international",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Gulf of Mexico rig counts remain steady with several contract extensions signed.",
    bodyMarkdown:
      "Gulf of Mexico rig counts remain steady as majors lock in 2025 contracts, with dayrates holding near last quarter's averages.",
    sources: ["https://www.rigzone.com/"],
    heroImageUrl: "https://example.com/images/rigs-us.jpg",
    heroImageSourceUrl: "https://www.rigzone.com/",
    heroImageAlt: "Rig operating in the Gulf of Mexico",
    selectedArticles: [
      {
        title: "GoM dayrates stabilize",
        url: "https://www.rigzone.com/article",
        briefContent: "Operators extend semis at steady rates for 2025 programs.",
        categoryImportance: "Limited downside for renewals; negotiate term flexibility.",
        sourceIndex: 1
      }
    ],
    vpSnapshot: {
      health: {
        overall: 64,
        costPressure: 45,
        supplyRisk: 40,
        scheduleRisk: 35,
        complianceRisk: 25,
        narrative: "Stable utilisation keeps costs steady but locks rigs early."
      },
      topSignals: [
        {
          title: "Operators locking 2025 terms early",
          type: "commercial",
          horizon: "30-180d",
          confidence: "high",
          impact: "Less spot flexibility later in the year.",
          evidenceArticleIndex: 1
        }
      ],
      recommendedActions: [
        {
          action: "Negotiate extension options with soft floors",
          ownerRole: "Category Manager",
          dueInDays: 30,
          expectedImpact: "Preserves access without locking full rate escalators.",
          confidence: "high",
          evidenceArticleIndex: 1
        }
      ],
      riskRegister: [
        {
          risk: "Reduced flexibility if demand lifts late 2025",
          probability: "medium",
          impact: "medium",
          mitigation: "Add substitution clauses into term deals.",
          trigger: "Operators announce additional wells",
          horizon: "180d+",
          evidenceArticleIndex: 1
        }
      ]
    }
  },
  {
    postId: "ds-au-001",
    title: "WA mud logging demand rising on back of appraisal wells",
    region: "au",
    portfolio: "drilling-services",
    runWindow: "apac",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Two appraisal wells in the Carnarvon basin are driving short-term mud logging demand.",
    bodyMarkdown:
      "Two appraisal wells in the Carnarvon basin are driving short-term mud logging demand and tightening specialist crews through Q3.",
    sources: ["https://www.businessnews.com.au/"],
    heroImageUrl: "https://example.com/images/drilling-services-au.jpg",
    heroImageSourceUrl: "https://www.businessnews.com.au/",
    heroImageAlt: "Drilling services crew at work"
  },
  {
    postId: "octg-us-001",
    title: "OCTG import prices ease as mills chase volume",
    region: "us-mx-la-lng",
    portfolio: "wells-materials-octg",
    runWindow: "international",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Lower HRC prices are feeding through to OCTG offers for Q2 deliveries.",
    bodyMarkdown:
      "Lower HRC prices are feeding through to OCTG offers for Q2 deliveries, with distributors reporting 3-5% discounts week over week.",
    sources: ["https://www.steelorbis.com/"],
    heroImageUrl: "https://example.com/images/octg.jpg",
    heroImageSourceUrl: "https://www.steelorbis.com/",
    heroImageAlt: "Steel pipes stored in a yard"
  },
  {
    postId: "subsea-au-001",
    title: "Subsea tie-back awards progress on Scarborough project",
    region: "au",
    portfolio: "subsea-surf-offshore",
    runWindow: "apac",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Contractors received ITTs for subsea hardware packages, firming 2025 vessel demand.",
    bodyMarkdown:
      "Contractors received ITTs for subsea hardware packages on Scarborough, firming 2025 vessel demand and supporting SURF pricing.",
    sources: ["https://www.offshore-mag.com/"],
    heroImageUrl: "https://example.com/images/subsea.jpg",
    heroImageSourceUrl: "https://www.offshore-mag.com/",
    heroImageAlt: "Subsea installation vessel"
  },
  {
    postId: "projects-us-001",
    title: "US LNG construction pipeline expands with new EPC award",
    region: "us-mx-la-lng",
    portfolio: "projects-epc-epcm-construction",
    runWindow: "international",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Another Gulf Coast LNG train reached FID, adding EPC backlog into 2026.",
    bodyMarkdown:
      "Another Gulf Coast LNG train reached FID, adding EPC backlog into 2026 and supporting craft labor demand at peak levels.",
    sources: ["https://www.lngindustry.com/"],
    heroImageUrl: "https://example.com/images/lng-project.jpg",
    heroImageSourceUrl: "https://www.lngindustry.com/",
    heroImageAlt: "LNG construction site"
  }
];
