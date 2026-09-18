"use client";

import { useState } from "react";
import { useTopProducts } from "@/lib/hooks/useTopProducts";
import type { TopProduct } from "@/lib/queries/topProducts";

// Enough rows to fill the card without crowding it — six keeps this
// roughly level with RegionalMapChart's height in the grid it sits
// next to on the overview page.
const ROW_LIMIT = 6;

// major_product_group -> fallback tile in public/images/products/categories/
// (see that folder's README, and branding/icons/generate_icons.py's ICONS
// dict for where these tiles come from). "box" is the catch-all for any
// group that isn't one of the seven modelled ones, so a future new
// product_group in the data doesn't render a broken image.
const CATEGORY_ICON: Record<string, string> = {
  Outerwear: "jacket",
  Midlayer: "hanger-2",
  Legwear: "hanger",
  Tops: "shirt",
  Accessories: "sock",
  Footwear: "shoe",
  "Camping & Equipment": "backpack",
};

function formatGbpCompact(value: number): string {
  return `£${(value / 1_000).toFixed(1)}K`;
}

/**
 * Plain <img>, not next/image, on purpose — most style/colourways won't
 * have a real photo sourced yet (see web/public/images/products/README.md),
 * so a 404-and-swap-to-fallback is the normal case here, not an edge
 * case. next/image's optimizer treats a missing local file as a hard
 * error rather than something you gracefully recover from with onError;
 * a plain img element's onError firing straight into a React state swap
 * is the simpler, more predictable tool for that.
 */
function ProductThumb({ product }: { product: TopProduct }) {
  const fallbackSrc = `/images/products/categories/${CATEGORY_ICON[product.majorProductGroup] ?? "box"}.png`;
  const [src, setSrc] = useState(`/images/products/${product.imagePath}.webp`);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      onError={() => setSrc(fallbackSrc)}
      alt=""
      className="h-11 w-11 flex-shrink-0 rounded-lg bg-white/10 object-cover"
    />
  );
}

export function TopProductsChart() {
  const top = useTopProducts(ROW_LIMIT);

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
      <h2 className="mb-3 text-sm font-medium text-cloud">Top products</h2>
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