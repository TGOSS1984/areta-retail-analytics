"use client";

import { useState } from "react";

// Shared by the Overview's top products card and the Products page table.

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

/**
 * Plain <img>, not next/image, on purpose — most style/colourways won't
 * have a real photo sourced yet (see web/public/images/products/README.md),
 * so a 404-and-swap-to-fallback is the normal case here, not an edge
 * case. next/image's optimizer treats a missing local file as a hard
 * error rather than something you gracefully recover from with onError;
 * a plain img element's onError firing straight into a React state swap
 * is the simpler, more predictable tool for that.
 */
export function ProductThumb({
  product,
  size = "h-11 w-11",
}: {
  product: { imagePath: string; majorProductGroup: string };
  size?: string;
}) {
  const fallbackSrc = `/images/products/categories/${CATEGORY_ICON[product.majorProductGroup] ?? "box"}.png`;
  const [src, setSrc] = useState(`/images/products/${product.imagePath}.webp`);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      onError={() => setSrc(fallbackSrc)}
      alt=""
      className={`${size} flex-shrink-0 rounded-lg bg-white/10 object-cover`}
    />
  );
}