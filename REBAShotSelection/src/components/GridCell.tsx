import { memo } from "react";
import type { Photo, UserProfile } from "../mockData";
import { USERS } from "../mockData";
import bbData from "../bbData.json";

const bbEntries = bbData as Array<{iw: number; ih: number}>;

function isLandscape(photoId: number): boolean {
  const bb = bbEntries[photoId];
  return bb ? bb.iw > bb.ih : false;
}

interface GridCellProps {
  photo: Photo;
  displayIndex: number;
  isMyDelete: boolean;
  isOtherDelete: boolean;
  isFocused: boolean;
  isSelected: boolean;
  otherUser: UserProfile;
  cellWidth: number;
  isAdmin?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
}

export const GridCell = memo(function GridCell({
  photo,
  displayIndex,
  isMyDelete,
  isOtherDelete,
  isFocused,
  isSelected,
  otherUser,
  cellWidth,
  isAdmin,
  onClick,
  onMouseEnter,
}: GridCellProps) {
  const landscape = isLandscape(photo.id);

  return (
    <div
      data-testid="grid-cell"
      className={`relative overflow-hidden rounded cursor-pointer transition-all
        ${isFocused ? "ring-2 ring-blue-500" : "border-3 border-transparent hover:border-gray-600"}
        ${isSelected ? "ring-2 ring-blue-400 bg-blue-900/30" : ""}
      `}
      style={{ width: cellWidth, aspectRatio: landscape ? "16/9" : "9/16" }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <img
        src={photo.thumbnailUrl}
        alt={photo.filename}
        loading="lazy"
        className={`w-full h-full object-cover transition-opacity
          ${isMyDelete ? "opacity-30 hover:opacity-60" : ""}
        `}
      />

      {isMyDelete && (
        <div className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold ${
          isAdmin ? "bg-red-600" : "bg-red-600"
        }`}>
          {isAdmin ? USERS["reviewer1"].avatar : "✕"}
        </div>
      )}

      {isOtherDelete && (
        <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
          {isAdmin ? USERS["reviewer2"].avatar : otherUser.avatar}
        </div>
      )}

      <div className="absolute bottom-1 left-1 bg-black/70 text-gray-400 text-[10px] px-1.5 py-0.5 rounded">
        {displayIndex + 1}
      </div>
    </div>
  );
});
