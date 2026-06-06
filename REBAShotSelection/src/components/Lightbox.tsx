import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Photo, UserProfile } from "../mockData";
import { USERS } from "../mockData";
import { toggleDelete } from "../store";

interface LightboxProps {
  photos: Photo[];
  initialIndex: number;
  currentIndex: number;
  setIndex: (i: number) => void;
  myDeleteSet: Set<number>;
  otherDeleteSet: Set<number>;
  otherUser: UserProfile;
  userId: string;
  isAdmin?: boolean;
  r1DeleteSet?: Set<number>;
  r2DeleteSet?: Set<number>;
  onClose: () => void;
}

export default function Lightbox({
  photos,
  currentIndex,
  setIndex,
  myDeleteSet,
  otherDeleteSet,
  otherUser,
  userId,
  isAdmin,
  r1DeleteSet,
  r2DeleteSet,
  onClose,
}: LightboxProps) {
  const photo = photos[currentIndex];
  if (!photo) return null;

  const isMyDelete = myDeleteSet.has(photo.id);
  const isOtherDelete = otherDeleteSet.has(photo.id);
  const isR1Delete = r1DeleteSet?.has(photo.id) ?? false;
  const isR2Delete = r2DeleteSet?.has(photo.id) ?? false;

  const nav = useCallback(
    (dir: number) => {
      let next = currentIndex + dir;
      if (next < 0) next = photos.length - 1;
      if (next >= photos.length) next = 0;
      setIndex(next);
    },
    [currentIndex, photos.length, setIndex]
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      e.stopPropagation();
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") nav(-1);
      else if (e.key === "ArrowRight") nav(1);
      else if (!isAdmin && (e.key === "x" || e.key === "X")) {
        toggleDelete(photo.id, userId);
      }
    }
    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [onClose, nav, photo.id, userId, isAdmin]);

  return createPortal(
    <div data-testid="lightbox" className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-5 text-white text-3xl cursor-pointer hover:text-gray-400"
      >
        &times;
      </button>

      <button
        onClick={() => nav(-1)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-4xl p-4 rounded hover:bg-white/10 cursor-pointer"
      >
        &#8249;
      </button>
      <button
        onClick={() => nav(1)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-4xl p-4 rounded hover:bg-white/10 cursor-pointer"
      >
        &#8250;
      </button>

      <img
        src={photo.fullUrl}
        alt={photo.filename}
        className="max-w-[90vw] max-h-[80vh] object-contain rounded"
      />

      <div className="mt-3 text-center text-sm text-gray-400 max-w-[90vw]">
        <div className="text-white font-bold text-base">{photo.filename}</div>
        <div className="mt-1">
          {currentIndex + 1} of {photos.length}
        </div>
        {isAdmin ? (
          <>
            {isR1Delete && (
              <div className="text-red-500 font-bold mt-1">{USERS["reviewer1"].name}: MARKED FOR DELETION</div>
            )}
            {isR2Delete && (
              <div className="text-orange-400 font-bold mt-1">{USERS["reviewer2"].name}: MARKED FOR DELETION</div>
            )}
            {!isR1Delete && !isR2Delete && (
              <div className="text-gray-500 mt-1">No deletions marked</div>
            )}
          </>
        ) : (
          <>
            {isMyDelete && (
              <div className="text-red-500 font-bold mt-1">MARKED FOR DELETION</div>
            )}
            {isOtherDelete && (
              <div className="text-orange-400 mt-1">
                {otherUser.name} also marked for deletion
              </div>
            )}
          </>
        )}
      </div>

      {!isAdmin && (
        <button
          onClick={() => toggleDelete(photo.id, userId)}
          className={`mt-3 px-6 py-2 rounded border-2 text-sm cursor-pointer transition-colors ${
            isMyDelete
              ? "border-red-500 bg-red-600 text-white"
              : "border-red-500 bg-transparent text-red-500 hover:bg-red-600 hover:text-white"
          }`}
        >
          {isMyDelete ? "Unmark Deletion" : "Mark for Deletion"}
        </button>
      )}
    </div>,
    document.body
  );
}
