import photoFilenames from "./photoFilenames.json";
import bbData from "./bbData.json";
import rebaScores from "./rebaScores.json";

export interface RebaInfo {
  sitename: string;
  task: string;
  scoreC: number;
  confidence: number;
  trackId: number;
  workerKey: string;
  frameIdx: number;
  timestampS: number;
}

export interface Photo {
  id: number;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  reba: RebaInfo | null;
}

export interface Vote {
  photoId: number;
  userId: string;
  action: "delete";
  votedAt: string;
}

export type UserRole = "reviewer" | "admin";

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
}

export const USERS: Record<string, UserProfile> = {
  reviewer1: { id: "reviewer1", name: "Reviewer 1", avatar: "R1", role: "reviewer" },
  reviewer2: { id: "reviewer2", name: "Reviewer 2", avatar: "R2", role: "reviewer" },
  admin: { id: "admin", name: "Admin", avatar: "A", role: "admin" },
};

export const CREDENTIALS: Record<string, string> = {
  reviewer1: import.meta.env.VITE_REVIEWER1_PASSWORD || "changeme1",
  reviewer2: import.meta.env.VITE_REVIEWER2_PASSWORD || "changeme2",
  admin: import.meta.env.VITE_ADMIN_PASSWORD || "changeme_admin",
};

const rebaLookup = rebaScores as Record<string, RebaInfo>;

export function generatePhotos(_count: number): Photo[] {
  return photoFilenames.map((filename, i) => {
    const bb = (bbData as Array<{iw: number; ih: number}>)[i];
    return {
      id: i,
      filename,
      thumbnailUrl: `/frames/${encodeURIComponent(filename)}`,
      fullUrl: `/frames/${encodeURIComponent(filename)}`,
      width: bb?.iw || 1080,
      height: bb?.ih || 1920,
      reba: rebaLookup[filename] || null,
    };
  });
}

export function generateMockVotes(photoCount: number): Vote[] {
  const votes: Vote[] = [];
  for (let i = 1; i <= photoCount; i++) {
    if (i % 7 === 0) {
      votes.push({ photoId: i, userId: "reviewer1", action: "delete", votedAt: new Date(Date.now() - Math.random() * 86400000).toISOString() });
    }
    if (i % 5 === 0) {
      votes.push({ photoId: i, userId: "reviewer2", action: "delete", votedAt: new Date(Date.now() - Math.random() * 86400000).toISOString() });
    }
    if (i % 11 === 0) {
      votes.push({ photoId: i, userId: "reviewer1", action: "delete", votedAt: new Date(Date.now() - Math.random() * 86400000).toISOString() });
      votes.push({ photoId: i, userId: "reviewer2", action: "delete", votedAt: new Date(Date.now() - Math.random() * 86400000).toISOString() });
    }
  }
  return votes;
}

const ALL_PHOTOS = generatePhotos(4023);
const ALL_VOTES = generateMockVotes(4023);

export function getPhotos(): Photo[] {
  return ALL_PHOTOS;
}

export function getVotes(): Vote[] {
  return ALL_VOTES;
}
