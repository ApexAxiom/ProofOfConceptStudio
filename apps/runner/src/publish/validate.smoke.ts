import { validateBrief } from "./validate.js";
import { BriefPost } from "@proof/shared";

const allowedUrls = new Set([
  "https://example.com/article-1",
  "https://example.com/article-2",
  "https://example.com/article-3",
  "https://example.com/article-4",
  "https://example.com/article-5",
  "https://index.example.com/region",
  "https://example.com/article-6"
]);

const indexUrls = new Set(["https://index.example.com/region"]);

const bodyMarkdown = `## 3 Takeaways
- Takeaway one with cite (https://example.com/article-1)
- Takeaway two with cite (https://example.com/article-2)
- Takeaway three with cite (https://example.com/article-3)

## Market Snapshot
- Market move with index cite (https://index.example.com/region)
- Market volume note (https://index.example.com/region)
- Market close (https://index.example.com/region)

## Developments
- Development one (https://example.com/article-4)
- Development two (https://example.com/article-5)
- Development three (https://example.com/article-6)
- Development four (https://example.com/article-1)
- Development five (https://example.com/article-2)

## Procurement Impact
- Impact one (https://example.com/article-3)
- Impact two (https://example.com/article-4)
- Impact three (https://example.com/article-5)

## Recommended Actions
- Action one (https://example.com/article-6)

## Sources
- https://example.com/article-1
- https://example.com/article-2
- https://example.com/article-3
- https://index.example.com/region
- https://example.com/article-4
- https://example.com/article-5
- https://example.com/article-6`;

const brief: BriefPost = {
  postId: "demo",
  title: "Demo Brief",
  region: "au",
  portfolio: "demo",
  runWindow: "am",
  status: "draft",
  publishedAt: new Date().toISOString(),
  summary: "This is a demo brief summary that satisfies the minimum length rule.",
  bodyMarkdown,
  selectedArticles: [
    { title: "Article 1", url: "https://example.com/article-1", briefContent: "A detailed summary of article one that exceeds limits." },
    { title: "Article 2", url: "https://example.com/article-2", briefContent: "A detailed summary of article two that exceeds limits." },
    { title: "Article 3", url: "https://example.com/article-3", briefContent: "A detailed summary of article three that exceeds limits." }
  ],
  sources: ["https://example.com/article-1"]
};

validateBrief(brief, allowedUrls, indexUrls);
console.log("OK");
