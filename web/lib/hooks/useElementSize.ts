"use client";

import { useEffect, useRef, useState } from "react";

/** Width and height of an element, kept up to date with a
 * ResizeObserver. Charts use it to change what they show at small sizes
 * (move a legend, drop labels, thin out ticks) instead of only shrinking. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}