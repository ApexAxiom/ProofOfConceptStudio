export function FooterSources({ sources }: { sources?: string[] }) {
  if (!sources?.length) return null;
  return (
    <div className="text-xs text-gray-600 border-t pt-2">
      <div className="font-semibold">Sources</div>
      <ul className="list-disc list-inside">
        {sources.map((s) => (
          <li key={s}>
            <a href={s} className="text-blue-600" target="_blank" rel="noreferrer">
              {s}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
