import { useState, useEffect, useLayoutEffect, type RefObject } from "react";

const GAP = 6;

export function useColumnCount(
  containerRef: RefObject<HTMLDivElement | null>,
  cellSize: number
) {
  const [columnCount, setColumnCount] = useState(6);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    setColumnCount(Math.max(2, Math.floor((w + GAP) / (cellSize + GAP))));
  }, [containerRef, cellSize]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timeout: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const w = entries[0].contentRect.width;
        setColumnCount(Math.max(2, Math.floor((w + GAP) / (cellSize + GAP))));
      }, 100);
    });

    observer.observe(el);
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [containerRef, cellSize]);

  const cellWidth = containerRef.current
    ? (containerRef.current.getBoundingClientRect().width - (columnCount - 1) * GAP) / columnCount
    : cellSize;

  return { columnCount, cellWidth, gap: GAP };
}
