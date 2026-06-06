import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { USERS } from "../mockData";
import { usePhotos, useVotes, useLoading, loadData, toggleDelete, batchDelete, batchUndoDelete, useCurrentUser } from "../store";
import { useColumnCount } from "../hooks/useColumnCount";
import { useGridKeyboard } from "../hooks/useGridKeyboard";
import { GridCell } from "../components/GridCell";
import Lightbox from "../components/Lightbox";
import ShortcutBar from "../components/ShortcutBar";
import bbData from "../bbData.json";
import type { RebaInfo } from "../mockData";

const bbEntries = bbData as Array<{iw: number; ih: number}>;

function rebaRiskLevel(score: number): { label: string; color: string; bg: string } {
  if (score <= 1) return { label: "Negligible", color: "text-green-400", bg: "bg-green-900/40" };
  if (score <= 3) return { label: "Low", color: "text-yellow-400", bg: "bg-yellow-900/40" };
  if (score <= 7) return { label: "Medium", color: "text-orange-400", bg: "bg-orange-900/40" };
  if (score <= 10) return { label: "High", color: "text-red-400", bg: "bg-red-900/40" };
  return { label: "Very High", color: "text-red-300", bg: "bg-red-800/50" };
}
function isLandscape(photoId: number): boolean {
  const bb = bbEntries[photoId];
  return bb ? bb.iw > bb.ih : false;
}

type Filter = "all" | "unreviewed" | "deleted" | "conflicts" | "both-deleted";
type Orientation = "landscape" | "portrait";

function downloadCsv(photos: { id: number; filename: string }[], r1Set: Set<number>, r2Set: Set<number>) {
  const header = "photo_id,filename,reviewer1_delete,reviewer2_delete";
  const rows = photos.map(
    (p) => `${p.id},${p.filename},${r1Set.has(p.id)},${r2Set.has(p.id)}`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rebashotselection-export-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReviewGrid() {
  const navigate = useNavigate();
  const { userId, role, logout } = useCurrentUser();
  const isLoading = useLoading();
  const photos = usePhotos();
  const votes = useVotes();

  useEffect(() => {
    if (isLoading && userId) loadData();
  }, [isLoading, userId]);
  const [orientationTab, setOrientationTab] = useState<Orientation>("landscape");
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewMode, setReviewMode] = useState(false);
  const [cellSize, setCellSize] = useState(180);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastClickIdx, setLastClickIdx] = useState(-1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const isAdmin = role === "admin";
  const me = USERS[userId || "reviewer1"];
  const r1 = USERS["reviewer1"];
  const r2 = USERS["reviewer2"];

  const r1DeleteSet = useMemo(() => {
    const s = new Set<number>();
    for (const v of votes) if (v.userId === "reviewer1") s.add(v.photoId);
    return s;
  }, [votes]);

  const r2DeleteSet = useMemo(() => {
    const s = new Set<number>();
    for (const v of votes) if (v.userId === "reviewer2") s.add(v.photoId);
    return s;
  }, [votes]);

  const myDeleteSet = isAdmin ? new Set<number>() : (userId === "reviewer1" ? r1DeleteSet : r2DeleteSet);
  const otherDeleteSet = isAdmin ? new Set<number>() : (userId === "reviewer1" ? r2DeleteSet : r1DeleteSet);
  const otherUser = isAdmin ? r2 : (userId === "reviewer1" ? r2 : r1);

  const orientationFiltered = useMemo(() =>
    photos.filter((p) => orientationTab === "landscape" ? isLandscape(p.id) : !isLandscape(p.id)),
    [photos, orientationTab]
  );

  const landscapeCount = useMemo(() => photos.filter((p) => isLandscape(p.id)).length, [photos]);
  const portraitCount = photos.length - landscapeCount;

  const filtered = useMemo(() => {
    const result = orientationFiltered;
    if (reviewMode && !isAdmin) {
      return result.filter((p) => myDeleteSet.has(p.id));
    }
    switch (filter) {
      case "unreviewed": return result.filter((p) => !r1DeleteSet.has(p.id) && !r2DeleteSet.has(p.id));
      case "deleted": return isAdmin
        ? result.filter((p) => r1DeleteSet.has(p.id) || r2DeleteSet.has(p.id))
        : result.filter((p) => myDeleteSet.has(p.id));
      case "conflicts": return result.filter((p) =>
        (r1DeleteSet.has(p.id) && !r2DeleteSet.has(p.id)) ||
        (!r1DeleteSet.has(p.id) && r2DeleteSet.has(p.id))
      );
      case "both-deleted": return result.filter((p) => r1DeleteSet.has(p.id) && r2DeleteSet.has(p.id));
      default: return result;
    }
  }, [orientationFiltered, filter, reviewMode, isAdmin, myDeleteSet, r1DeleteSet, r2DeleteSet]);

  const { columnCount, cellWidth, gap } = useColumnCount(gridRef, cellSize);
  const rowCount = Math.ceil(filtered.length / columnCount);
  const rowHeight = orientationTab === "landscape"
    ? cellWidth * (9 / 16) + gap
    : cellWidth * (16 / 9) + gap;

  const estimateSize = useCallback(() => rowHeight, [rowHeight]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 5,
  });

  const handleMarkDelete = useCallback(
    (idx: number) => {
      if (isAdmin || !userId || idx < 0 || idx >= filtered.length) return;
      const photoId = filtered[idx].id;
      if (!myDeleteSet.has(photoId)) toggleDelete(photoId, userId);
    },
    [isAdmin, userId, filtered, myDeleteSet]
  );

  const handleUndoDelete = useCallback(
    (idx: number) => {
      if (isAdmin || !userId || idx < 0 || idx >= filtered.length) return;
      const photoId = filtered[idx].id;
      if (myDeleteSet.has(photoId)) toggleDelete(photoId, userId);
    },
    [isAdmin, userId, filtered, myDeleteSet]
  );

  const handleOpenLightbox = useCallback((idx: number) => {
    setLightboxIdx(idx);
    setLightboxOpen(true);
  }, []);

  const { focusedIdx, setFocusedIdx, handleKeyDown } = useGridKeyboard({
    filteredCount: filtered.length,
    columnCount,
    virtualizer,
    isLightboxOpen: lightboxOpen,
    onMarkDelete: handleMarkDelete,
    onUndoDelete: handleUndoDelete,
    onOpenLightbox: handleOpenLightbox,
  });

  const handleCardClick = useCallback(
    (idx: number, e: React.MouseEvent) => {
      if (!userId) return;
      if (isAdmin) {
        setFocusedIdx(idx);
        return;
      }
      if (e.shiftKey && lastClickIdx >= 0) {
        const start = Math.min(lastClickIdx, idx);
        const end = Math.max(lastClickIdx, idx);
        setSelected((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(i);
          return next;
        });
      } else if (e.ctrlKey || e.metaKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(idx)) next.delete(idx); else next.add(idx);
          return next;
        });
      } else {
        if (selected.size > 0) {
          setSelected(new Set());
        } else {
          toggleDelete(filtered[idx].id, userId);
        }
      }
      setLastClickIdx(idx);
      setFocusedIdx(idx);
    },
    [userId, isAdmin, lastClickIdx, selected.size, filtered, setFocusedIdx]
  );

  const handleEscape = useCallback(() => {
    if (lightboxOpen) { setLightboxOpen(false); return; }
    if (selected.size > 0) { setSelected(new Set()); return; }
  }, [lightboxOpen, selected.size]);

  const r1Total = r1DeleteSet.size;
  const r2Total = r2DeleteSet.size;
  const bothDeleted = photos.filter((p) => r1DeleteSet.has(p.id) && r2DeleteSet.has(p.id)).length;
  const conflicts = photos.filter((p) =>
    (r1DeleteSet.has(p.id) && !r2DeleteSet.has(p.id)) ||
    (!r1DeleteSet.has(p.id) && r2DeleteSet.has(p.id))
  ).length;

  useEffect(() => {
    if (!isLoading) containerRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    if (!userId) navigate("/");
  }, [userId, navigate]);

  if (!userId) return null;

  if (isLoading) {
    return (
      <div className="h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading photos...</div>
      </div>
    );
  }

  const shortcutMode = lightboxOpen ? "lightbox" : selected.size > 0 ? "selection" : isAdmin ? "admin" : "grid";

  return (
    <div
      ref={containerRef}
      className="h-screen bg-[#1a1a1a] text-gray-200 flex flex-col outline-none"
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.preventDefault(); handleEscape(); return; }
        handleKeyDown(e);
      }}
      tabIndex={0}
    >
      <header className="sticky top-0 z-50 bg-[#2a2a2a] border-b border-gray-700 px-5 py-2.5 flex items-center gap-5 flex-wrap">
        <h1 className="text-base font-semibold">REBAShotSelection</h1>

        <div className="flex rounded border border-gray-600 overflow-hidden">
          {([
            ["landscape", `Landscape (${landscapeCount})`],
            ["portrait", `Portrait (${portraitCount})`],
          ] as [Orientation, string][]).map(([o, label]) => (
            <button
              key={o}
              data-testid={`orientation-${o}`}
              onClick={() => {
                setOrientationTab(o);
                setFocusedIdx(-1);
                setSelected(new Set());
                setLastClickIdx(-1);
              }}
              className={`px-3 py-1 text-sm cursor-pointer transition-colors ${
                orientationTab === o
                  ? "bg-blue-600 text-white"
                  : "bg-[#333] text-gray-400 hover:text-white hover:bg-[#444]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="text-sm text-gray-500">
          Showing: <b className="text-white text-base">{filtered.length}</b>
          <span className="text-gray-600"> of {photos.length}</span>
        </span>
        <span className="text-sm text-gray-500" data-testid="stats-r1-deletes">
          {r1.name}: <b className="text-red-500 text-base">{r1Total}</b>
        </span>
        <span className="text-sm text-gray-500" data-testid="stats-r2-deletes">
          {r2.name}: <b className="text-orange-400 text-base">{r2Total}</b>
        </span>
        <span className="text-sm text-gray-500">
          Agree: <b className="text-green-400">{bothDeleted}</b>
        </span>
        <span className="text-sm text-gray-500">
          Conflicts: <b className="text-yellow-400">{conflicts}</b>
        </span>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-500">Grid size</label>
          <input
            type="range" min={100} max={300} step={20} value={cellSize}
            onChange={(e) => setCellSize(Number(e.target.value))}
            className="w-28 accent-red-500"
            data-testid="grid-size-slider"
          />
        </div>

        {!isAdmin && (
          <button
            onClick={() => { setReviewMode(!reviewMode); setFocusedIdx(-1); }}
            className={`px-3 py-1.5 text-sm rounded border cursor-pointer transition-colors ${
              reviewMode
                ? "bg-red-600 border-red-500 text-white"
                : "bg-[#333] border-gray-600 text-gray-300 hover:bg-[#444]"
            }`}
          >
            {reviewMode ? "Show All" : "Review Marked"}
          </button>
        )}

        {isAdmin && (
          <button
            data-testid="download-csv"
            onClick={() => downloadCsv(photos, r1DeleteSet, r2DeleteSet)}
            className="px-3 py-1.5 text-sm rounded border border-purple-500 bg-purple-600 text-white hover:bg-purple-500 cursor-pointer transition-colors"
          >
            Download CSV
          </button>
        )}

        <button
          onClick={() => navigate("/consensus")}
          className="px-3 py-1.5 text-sm rounded border border-gray-600 bg-[#333] text-gray-300 hover:bg-[#444] cursor-pointer"
        >
          Consensus
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-gray-600">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
            isAdmin ? "bg-purple-600" : "bg-blue-600"
          }`}>{me.avatar}</div>
          <span className="text-sm text-gray-400">{me.name}</span>
          <button onClick={logout} className="text-gray-600 hover:text-gray-300 cursor-pointer">&times;</button>
        </div>
      </header>

      {!reviewMode && (
        <div className="bg-[#222] border-b border-gray-700 px-5 py-1.5 flex gap-1">
          {([
            ["all", "All"],
            ["unreviewed", "Unreviewed"],
            ["deleted", isAdmin ? "Any Deleted" : "My Deletes"],
            ["conflicts", "Conflicts"],
            ["both-deleted", "Both Deleted"],
          ] as [Filter, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setFocusedIdx(-1); }}
              className={`px-3 py-1 text-sm rounded cursor-pointer transition-colors ${
                filter === f ? "bg-blue-600 text-white" : "text-gray-500 hover:text-white hover:bg-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!isAdmin && selected.size > 0 && (
        <div className="bg-[#2a2a2a] border-b-2 border-blue-500 px-5 py-2.5 text-center text-sm">
          <span className="text-blue-300 mr-4">{selected.size} selected</span>
          <button
            onClick={() => {
              batchDelete([...selected].map((i) => filtered[i].id), userId);
              setSelected(new Set());
            }}
            className="bg-red-600 text-white px-4 py-1.5 rounded mx-2 cursor-pointer"
          >
            Mark for Deletion
          </button>
          <button
            onClick={() => {
              batchUndoDelete([...selected].map((i) => filtered[i].id), userId);
              setSelected(new Set());
            }}
            className="bg-gray-600 text-white px-4 py-1.5 rounded mx-2 cursor-pointer"
          >
            Unmark
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="bg-gray-600 text-white px-4 py-1.5 rounded mx-2 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-auto pb-12">
          <div
            ref={gridRef}
            className="px-2.5 pt-2.5"
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const startIdx = virtualRow.index * columnCount;
              return (
                <div
                  key={virtualRow.index}
                  className="absolute left-0 right-0 px-2.5 flex items-start"
                  style={{
                    top: virtualRow.start,
                    height: virtualRow.size,
                    gap,
                  }}
                >
                  {Array.from({ length: columnCount }, (_, col) => {
                    const idx = startIdx + col;
                    if (idx >= filtered.length) return <div key={col} style={{ width: cellWidth }} />;
                    const photo = filtered[idx];
                    return (
                      <GridCell
                        key={photo.id}
                        photo={photo}
                        displayIndex={idx}
                        isMyDelete={isAdmin ? r1DeleteSet.has(photo.id) : myDeleteSet.has(photo.id)}
                        isOtherDelete={isAdmin ? r2DeleteSet.has(photo.id) : otherDeleteSet.has(photo.id)}
                        isFocused={idx === focusedIdx}
                        isSelected={selected.has(idx)}
                        otherUser={otherUser}
                        cellWidth={cellWidth}
                        isAdmin={isAdmin}
                        onClick={(e) => handleCardClick(idx, e)}
                        onMouseEnter={() => { setFocusedIdx(idx); containerRef.current?.focus(); }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-2/5 min-w-[350px] max-w-[500px] border-l border-gray-700 bg-[#222] flex flex-col" data-testid="preview-panel">
          {focusedIdx >= 0 && focusedIdx < filtered.length ? (() => {
            const fp = filtered[focusedIdx];
            const r1Del = r1DeleteSet.has(fp.id);
            const r2Del = r2DeleteSet.has(fp.id);
            const isMyDel = isAdmin ? false : myDeleteSet.has(fp.id);
            return (
              <>
                <div className="flex-1 flex items-center justify-center bg-black p-2 min-h-0">
                  <img
                    src={fp.fullUrl}
                    alt={fp.filename}
                    className={`max-w-full max-h-full object-contain ${(isMyDel || r1Del || r2Del) ? "opacity-50" : ""}`}
                  />
                </div>
                <div className="p-3 space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 font-medium truncate">{fp.filename}</span>
                    <span className="text-xs text-gray-500">Frame {focusedIdx + 1} of {filtered.length}</span>
                  </div>
                  {fp.reba && (() => {
                    const reba = fp.reba as RebaInfo;
                    const risk = rebaRiskLevel(reba.scoreC);
                    return (
                      <div className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${risk.bg}`}>
                        <span className={`font-bold ${risk.color}`}>REBA {reba.scoreC}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">{reba.task}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400">{(reba.confidence * 100).toFixed(0)}%</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-gray-400 truncate">{reba.sitename}</span>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">{r1.avatar}</div>
                      <span className={r1Del ? "text-red-400 font-medium" : "text-gray-600"}>{r1Del ? "DELETE" : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white">{r2.avatar}</div>
                      <span className={r2Del ? "text-orange-400 font-medium" : "text-gray-600"}>{r2Del ? "DELETE" : "—"}</span>
                    </div>
                  </div>
                  {!isAdmin && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleMarkDelete(focusedIdx)}
                        disabled={isMyDel}
                        className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                          isMyDel
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-red-600 text-white hover:bg-red-500 cursor-pointer"
                        }`}
                      >
                        X — Delete
                      </button>
                      <button
                        onClick={() => handleUndoDelete(focusedIdx)}
                        disabled={!isMyDel}
                        className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                          !isMyDel
                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                            : "bg-gray-600 text-white hover:bg-gray-500 cursor-pointer"
                        }`}
                      >
                        U — Undo
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })() : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
              Hover or navigate to a frame to preview
            </div>
          )}
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox
          photos={filtered}
          initialIndex={lightboxIdx}
          currentIndex={lightboxIdx}
          setIndex={setLightboxIdx}
          myDeleteSet={myDeleteSet}
          otherDeleteSet={otherDeleteSet}
          otherUser={otherUser}
          userId={userId}
          isAdmin={isAdmin}
          r1DeleteSet={r1DeleteSet}
          r2DeleteSet={r2DeleteSet}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <ShortcutBar mode={shortcutMode} selectionCount={selected.size} />
    </div>
  );
}
