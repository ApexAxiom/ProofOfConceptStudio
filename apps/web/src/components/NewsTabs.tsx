"use client";

import { useState } from "react";

export interface NewsTabArticle {
  title: string;
  url: string;
}

export interface NewsTab {
  id: string;
  label: string;
  description?: string;
  articles: NewsTabArticle[];
}

/**
 * Single tabbed news block replacing the three stacked news sections
 * (Woodside / APAC / International) that used to render 18 cards at once.
 */
export function NewsTabs({ tabs }: { tabs: NewsTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  if (!active) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              tab.id === active.id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active.description ? <p className="mt-2 text-xs text-muted-foreground">{active.description}</p> : null}
      <ul className="mt-3 divide-y divide-border">
        {active.articles.map((article) => (
          <li key={article.url}>
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block px-2 py-2 text-sm text-foreground transition hover:bg-secondary/40 hover:text-primary"
            >
              {article.title}
            </a>
          </li>
        ))}
        {active.articles.length === 0 ? (
          <li className="px-2 py-3 text-sm text-muted-foreground">No stories available from these sources right now.</li>
        ) : null}
      </ul>
    </div>
  );
}
