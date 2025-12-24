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
    runWindow: "am",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Woodside and Santos sanctioned new well work, tightening jack-up availability.",
    bodyMarkdown:
      "Woodside and Santos sanctioned new 2025 well work off WA, lifting jack-up and semi demand across the North West Shelf.",
    sources: ["https://www.energytodaymag.com.au/"],
    heroImageUrl: "https://example.com/images/rigs-au.jpg",
    heroImageSourceUrl: "https://www.energytodaymag.com.au/",
    heroImageAlt: "Offshore rig in Australian waters"
  },
  {
    postId: "rigs-us-001",
    title: "US Gulf drilling stabilizes as operators finalize 2025 programs",
    region: "us-mx-la-lng",
    portfolio: "rigs-integrated-drilling",
    runWindow: "am",
    status: "published",
    publishedAt: new Date().toISOString(),
    summary: "Gulf of Mexico rig counts remain steady with several contract extensions signed.",
    bodyMarkdown:
      "Gulf of Mexico rig counts remain steady as majors lock in 2025 contracts, with dayrates holding near last quarter's averages.",
    sources: ["https://www.rigzone.com/"],
    heroImageUrl: "https://example.com/images/rigs-us.jpg",
    heroImageSourceUrl: "https://www.rigzone.com/",
    heroImageAlt: "Rig operating in the Gulf of Mexico"
  },
  {
    postId: "ds-au-001",
    title: "WA mud logging demand rising on back of appraisal wells",
    region: "au",
    portfolio: "drilling-services",
    runWindow: "pm",
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
    runWindow: "pm",
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
    runWindow: "am",
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
    runWindow: "am",
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
