import React from "react";
import { BriefPost } from "@proof/shared";

const DEFAULT_VISIBLE = 5;

interface SupplierRadarProps {
  brief?: BriefPost;
}

export function SupplierRadar({ brief }: SupplierRadarProps): React.ReactElement | null {
  const items = brief?.cmSnapshot?.supplierRadar ?? [];
  if (items.length === 0) return null;

  const visibleItems = items.slice(0, DEFAULT_VISIBLE);

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left">Supplier</th>
            <th className="px-3 py-2 text-left">Signal</th>
            <th className="px-3 py-2 text-left">Implication</th>
            <th className="px-3 py-2 text-left">Next step</th>
            <th className="px-3 py-2 text-left">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.map((item, idx) => (
            <tr
              key={`${item.supplier}-${idx}`}
              className="border-b border-border/80 last:border-0"
            >
              <td className="px-3 py-2 text-foreground">{item.supplier}</td>
              <td className="px-3 py-2 text-muted-foreground">{item.signal}</td>
              <td className="px-3 py-2 text-muted-foreground">{item.implication}</td>
              <td className="px-3 py-2 text-muted-foreground">{item.nextStep}</td>
              <td className="px-3 py-2 text-muted-foreground capitalize">{item.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

