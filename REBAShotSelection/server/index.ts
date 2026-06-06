import express from "express";
import { Firestore } from "@google-cloud/firestore";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const db = new Firestore({ databaseId: "rebashotselection" });
const GCS_BUCKET = process.env.GCS_BUCKET || "frame-validation-data";
const GCS_BASE = `https://storage.googleapis.com/${GCS_BUCKET}/frames_annotated`;
const SECRET = process.env.SESSION_SECRET || "rebashotselection-secret";

const CREDENTIALS: Record<string, string> = {
  reviewer1: process.env.REVIEWER1_PASSWORD || "changeme1",
  reviewer2: process.env.REVIEWER2_PASSWORD || "changeme2",
  admin: process.env.ADMIN_PASSWORD || "changeme_admin",
};

const USERS: Record<string, { name: string; role: string }> = {
  reviewer1: { name: "Reviewer 1", role: "reviewer" },
  reviewer2: { name: "Reviewer 2", role: "reviewer" },
  admin: { name: "Admin", role: "admin" },
};

function signToken(userId: string): string {
  const sig = crypto.createHmac("sha256", SECRET).update(userId).digest("hex").slice(0, 16);
  return `${userId}:${sig}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split(":");
  if (parts.length !== 2) return null;
  const [userId, sig] = parts;
  if (!USERS[userId]) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(userId).digest("hex").slice(0, 16);
  return sig === expected ? userId : null;
}

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const userId = verifyToken(header.slice(7));
  if (!userId) return res.status(401).json({ error: "Invalid token" });
  (req as any).userId = userId;
  (req as any).role = USERS[userId].role;
  next();
}

app.post("/api/auth/login", (req, res) => {
  const { userId, password } = req.body;
  if (!CREDENTIALS[userId] || CREDENTIALS[userId] !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ token: signToken(userId), userId, role: USERS[userId].role });
});

app.get("/api/photos", auth, async (_req, res) => {
  try {
    const snapshot = await db.collection("photos").orderBy("id").get();
    const photos = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: d.id,
        filename: d.filename,
        thumbnailUrl: `${GCS_BASE}/${encodeURIComponent(d.filename)}`,
        fullUrl: `${GCS_BASE}/${encodeURIComponent(d.filename)}`,
        width: 800,
        height: 600,
      };
    });
    res.json(photos);
  } catch (err) {
    console.error("Error fetching photos:", err);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

app.get("/api/votes", auth, async (_req, res) => {
  try {
    const snapshot = await db.collection("votes").get();
    res.json(snapshot.docs.map((doc) => doc.data()));
  } catch (err) {
    console.error("Error fetching votes:", err);
    res.status(500).json({ error: "Failed to fetch votes" });
  }
});

app.post("/api/votes/toggle", auth, async (req, res) => {
  const { photoId } = req.body;
  const userId = (req as any).userId;
  if ((req as any).role === "admin") return res.status(403).json({ error: "Admin cannot vote" });

  const docId = `${photoId}_${userId}`;
  const ref = db.collection("votes").doc(docId);
  try {
    const doc = await ref.get();
    if (doc.exists) {
      await ref.delete();
      res.json({ action: "removed", photoId, userId });
    } else {
      const vote = { photoId, userId, action: "delete", votedAt: new Date().toISOString() };
      await ref.set(vote);
      res.json({ action: "added", ...vote });
    }
  } catch (err) {
    console.error("Error toggling vote:", err);
    res.status(500).json({ error: "Failed to toggle vote" });
  }
});

app.post("/api/votes/batch-delete", auth, async (req, res) => {
  const { photoIds } = req.body;
  const userId = (req as any).userId;
  if ((req as any).role === "admin") return res.status(403).json({ error: "Admin cannot vote" });

  try {
    for (let i = 0; i < photoIds.length; i += 500) {
      const batch = db.batch();
      for (const pid of photoIds.slice(i, i + 500)) {
        batch.set(db.collection("votes").doc(`${pid}_${userId}`), {
          photoId: pid, userId, action: "delete", votedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
    }
    res.json({ count: photoIds.length });
  } catch (err) {
    console.error("Error batch delete:", err);
    res.status(500).json({ error: "Failed to batch delete" });
  }
});

app.post("/api/votes/batch-undo", auth, async (req, res) => {
  const { photoIds } = req.body;
  const userId = (req as any).userId;
  if ((req as any).role === "admin") return res.status(403).json({ error: "Admin cannot vote" });

  try {
    for (let i = 0; i < photoIds.length; i += 500) {
      const batch = db.batch();
      for (const pid of photoIds.slice(i, i + 500)) {
        batch.delete(db.collection("votes").doc(`${pid}_${userId}`));
      }
      await batch.commit();
    }
    res.json({ count: photoIds.length });
  } catch (err) {
    console.error("Error batch undo:", err);
    res.status(500).json({ error: "Failed to batch undo" });
  }
});

const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = parseInt(process.env.PORT || "3001");
app.listen(PORT, "0.0.0.0", () => console.log(`REBAShotSelection server on port ${PORT}`));
