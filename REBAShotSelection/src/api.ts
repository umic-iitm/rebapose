function hdrs(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function login(userId: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json() as Promise<{ token: string; userId: string; role: string }>;
}

export async function getPhotos(token: string) {
  const res = await fetch("/api/photos", { headers: hdrs(token) });
  if (!res.ok) throw new Error("Failed to fetch photos");
  return res.json();
}

export async function getVotes(token: string) {
  const res = await fetch("/api/votes", { headers: hdrs(token) });
  if (!res.ok) throw new Error("Failed to fetch votes");
  return res.json();
}

export async function toggleVote(token: string, photoId: number) {
  const res = await fetch("/api/votes/toggle", {
    method: "POST", headers: hdrs(token), body: JSON.stringify({ photoId }),
  });
  if (!res.ok) throw new Error("Failed to toggle vote");
  return res.json();
}

export async function batchDeleteVotes(token: string, photoIds: number[]) {
  const res = await fetch("/api/votes/batch-delete", {
    method: "POST", headers: hdrs(token), body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error("Failed to batch delete");
  return res.json();
}

export async function batchUndoVotes(token: string, photoIds: number[]) {
  const res = await fetch("/api/votes/batch-undo", {
    method: "POST", headers: hdrs(token), body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) throw new Error("Failed to batch undo");
  return res.json();
}
