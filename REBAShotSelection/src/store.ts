import { useState, useCallback, useSyncExternalStore } from "react";
import { type Photo, type Vote, type UserRole, type RebaInfo, USERS, generatePhotos, generateMockVotes } from "./mockData";
import * as api from "./api";
import rebaScores from "./rebaScores.json";

const rebaLookup = rebaScores as Record<string, RebaInfo>;

function enrichWithReba(photoList: Photo[]): Photo[] {
  return photoList.map(p => ({ ...p, reba: rebaLookup[p.filename] || null }));
}

let photos: Photo[] = [];
let votes: Vote[] = [];
let loading = true;
let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => { listeners = listeners.filter((l) => l !== listener); };
}

function getToken(): string | null {
  return sessionStorage.getItem("authToken");
}

let loadPromise: Promise<void> | null = null;

export async function loadData(): Promise<void> {
  if (!loading) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const token = getToken();
    if (token) {
      try {
        const [p, v] = await Promise.all([api.getPhotos(token), api.getVotes(token)]);
        photos = enrichWithReba(p);
        votes = v;
        loading = false;
        emitChange();
        return;
      } catch {
        // API not available — fall through to mock
      }
    }
    photos = generatePhotos(4023);
    votes = generateMockVotes(4023);
    loading = false;
    emitChange();
  })();
  return loadPromise;
}

export function _resetForTest(initialVotes: Vote[] = []) {
  photos = generatePhotos(4023);
  votes = initialVotes;
  loading = false;
  loadPromise = null;
  emitChange();
}

export function _getVotesRaw(): Vote[] {
  return votes;
}

export function usePhotos() {
  return useSyncExternalStore(subscribe, () => photos);
}

export function useVotes(): Vote[] {
  return useSyncExternalStore(subscribe, () => votes);
}

export function useLoading(): boolean {
  return useSyncExternalStore(subscribe, () => loading);
}

export function toggleDelete(photoId: number, userId: string) {
  const existing = votes.find((v) => v.photoId === photoId && v.userId === userId);
  if (existing) {
    votes = votes.filter((v) => !(v.photoId === photoId && v.userId === userId));
  } else {
    votes = [...votes, { photoId, userId, action: "delete", votedAt: new Date().toISOString() }];
  }
  emitChange();

  const token = getToken();
  if (token) api.toggleVote(token, photoId).catch(console.error);
}

export function batchDelete(photoIds: number[], userId: string) {
  const newVotes = photoIds
    .filter((id) => !votes.some((v) => v.photoId === id && v.userId === userId))
    .map((id) => ({ photoId: id, userId, action: "delete" as const, votedAt: new Date().toISOString() }));
  votes = [...votes, ...newVotes];
  emitChange();

  const token = getToken();
  if (token) api.batchDeleteVotes(token, photoIds).catch(console.error);
}

export function batchUndoDelete(photoIds: number[], userId: string) {
  votes = votes.filter((v) => !(photoIds.includes(v.photoId) && v.userId === userId));
  emitChange();

  const token = getToken();
  if (token) api.batchUndoVotes(token, photoIds).catch(console.error);
}

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(
    () => sessionStorage.getItem("currentUser")
  );

  const role: UserRole | null = userId && USERS[userId] ? USERS[userId].role : null;

  const login = useCallback((id: string) => {
    sessionStorage.setItem("currentUser", id);
    setUserId(id);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("authToken");
    setUserId(null);
    photos = [];
    votes = [];
    loading = true;
    loadPromise = null;
    emitChange();
  }, []);

  return { userId, role, login, logout };
}
