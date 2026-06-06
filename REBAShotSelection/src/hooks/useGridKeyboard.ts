import { useState, useCallback, type KeyboardEvent } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";

interface UseGridKeyboardOptions {
  filteredCount: number;
  columnCount: number;
  virtualizer: Virtualizer<HTMLDivElement, Element> | null;
  isLightboxOpen: boolean;
  onMarkDelete: (index: number) => void;
  onUndoDelete: (index: number) => void;
  onOpenLightbox: (index: number) => void;
}

export function useGridKeyboard({
  filteredCount,
  columnCount,
  virtualizer,
  isLightboxOpen,
  onMarkDelete,
  onUndoDelete,
  onOpenLightbox,
}: UseGridKeyboardOptions) {
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isLightboxOpen) return;
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      const key = e.key;

      if (key === "x" || key === "X") {
        e.preventDefault();
        if (focusedIdx >= 0 && focusedIdx < filteredCount) {
          onMarkDelete(focusedIdx);
        }
        return;
      }

      if (key === "u" || key === "U") {
        e.preventDefault();
        if (focusedIdx >= 0 && focusedIdx < filteredCount) {
          onUndoDelete(focusedIdx);
        }
        return;
      }

      if (key === "Enter") {
        e.preventDefault();
        if (focusedIdx >= 0 && focusedIdx < filteredCount) {
          onOpenLightbox(focusedIdx);
        }
        return;
      }

      if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(key)) {
        e.preventDefault();
        if (filteredCount === 0) return;

        let newIdx = focusedIdx;
        if (focusedIdx < 0) {
          newIdx = 0;
        } else if (key === "ArrowRight") {
          newIdx = Math.min(focusedIdx + 1, filteredCount - 1);
        } else if (key === "ArrowLeft") {
          newIdx = Math.max(focusedIdx - 1, 0);
        } else if (key === "ArrowDown") {
          newIdx = Math.min(focusedIdx + columnCount, filteredCount - 1);
        } else if (key === "ArrowUp") {
          newIdx = Math.max(focusedIdx - columnCount, 0);
        }

        setFocusedIdx(newIdx);

        if (virtualizer) {
          const rowIdx = Math.floor(newIdx / columnCount);
          virtualizer.scrollToIndex(rowIdx, { align: "auto" });
        }
      }
    },
    [focusedIdx, filteredCount, columnCount, virtualizer, isLightboxOpen, onMarkDelete, onUndoDelete, onOpenLightbox]
  );

  const resetFocus = useCallback(() => setFocusedIdx(-1), []);

  return { focusedIdx, setFocusedIdx, handleKeyDown, resetFocus };
}
