interface ShortcutBarProps {
  mode: "grid" | "lightbox" | "selection" | "admin";
  selectionCount?: number;
}

export default function ShortcutBar({ mode, selectionCount = 0 }: ShortcutBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#2a2a2a] border-t border-gray-700 px-4 py-2.5 text-xs text-gray-500 flex items-center justify-center gap-6">
      {mode === "lightbox" && (
        <>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">←→</kbd> Navigate</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">X</kbd> Toggle delete</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">Esc</kbd> Close</span>
        </>
      )}
      {mode === "selection" && (
        <>
          <span className="text-blue-400">{selectionCount} selected</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">Esc</kbd> Clear selection</span>
        </>
      )}
      {mode === "grid" && (
        <>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">←→↑↓</kbd> Navigate</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">X</kbd> Delete</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">U</kbd> Undo</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">Enter</kbd> Lightbox</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">Shift+Click</kbd> Range select</span>
        </>
      )}
      {mode === "admin" && (
        <>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">Enter</kbd> Lightbox</span>
          <span><kbd className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">←→↑↓</kbd> Navigate</span>
          <span className="text-purple-400">View-only mode</span>
        </>
      )}
    </div>
  );
}
