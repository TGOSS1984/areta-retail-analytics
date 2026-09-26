"use client";

import { useTopProducts } from "@/lib/hooks/useTopProducts";
import { useResolvedFilters } from "@/lib/hooks/useFilteredData";
import { ProductThumb } from "@/components/ui/ProductThumb";

// Enough rows to fill the card without crowding it — six keeps this
// roughly level with RegionalMapChart's height in the grid it sits
// next to on the overview page.
const ROW_LIMIT = 6;

function formatGbpCompact(value: number): string {
  return `£${(value / 1_000).toFixed(1)}K`;
}

export function TopProductsChart() {
  const top = useTopProducts(ROW_LIMIT);
  const filters = useResolvedFilters();

  if (top.status === "loading") {
    return <div className="h-full animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }

  if (top.status === "error") {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-mist">
        Couldn&apos;t load top products: {top.message}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-deep-terrain p-5">
      <h2 className="text-sm font-medium text-cloud">Top products</h2>
      {/* The product export has no store column, so it can't follow the
          market filter. Say so rather than show the wrong thing quietly. */}
      <p className="mb-3 mt-0.5 text-xs text-mist">{filters?.market ? "All markets · product data isn't split by market" : "By sales value"}</p>
      <ul className="flex flex-1 flex-col justify-between gap-3">
        {top.data.map((product) => (
          <li key={`${product.styleCode}-${product.colourCode}`} className="flex items-center gap-3">
            <ProductThumb product={product} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-cloud">{product.styleName}</p>
              <p className="truncate text-xs text-mist">
                {product.colour} &middot; {product.brandName}
              </p>
            </div>
            <p className="flex-shrink-0 text-sm font-medium text-cloud">
              {formatGbpCompact(product.salesGbp)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}