import { Firestore } from "@google-cloud/firestore";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import path from "path";

const db = new Firestore({ databaseId: "rebashotselection" });
const GCS_BUCKET = process.env.GCS_BUCKET || "frame-validation-data";

async function seed() {
  console.log("Fetching CSV from GCS...");
  const csvUrl = `https://storage.googleapis.com/${GCS_BUCKET}/selected_frames_tasks_rebascores.csv`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
  const csvText = await res.text();

  const rows: Record<string, string>[] = parse(csvText, { columns: true, skip_empty_lines: true });
  console.log(`CSV has ${rows.length} rows`);

  const photos = rows.map((row, i) => {
    const stemId = row.stem_id || path.basename(row.work_path || "", path.extname(row.work_path || ""));
    const frameIdx = parseInt(row.frame_idx);
    const trackId = parseInt(row.track_id || "0");
    const filename = `${stemId}__f${String(frameIdx).padStart(6, "0")}__t${String(trackId).padStart(3, "0")}.jpg`;
    return { id: i, filename };
  });

  console.log("Writing photos to Firestore...");
  for (let i = 0; i < photos.length; i += 500) {
    const batch = db.batch();
    for (const photo of photos.slice(i, i + 500)) {
      batch.set(db.collection("photos").doc(String(photo.id)), photo);
    }
    await batch.commit();
    console.log(`  Photos batch: ${i}–${Math.min(i + 499, photos.length - 1)}`);
  }

  const user1Path = process.argv[2];
  const user2Path = process.argv[3];
  if (!user1Path || !user2Path) {
    console.log("Usage: npx tsx server/seed.ts <reviewer1_votes.json> <reviewer2_votes.json>");
    console.log("Vote files should be JSON objects where keys are photo IDs and values have {delete: true/false}");
    process.exit(1);
  }

  const u1 = JSON.parse(readFileSync(user1Path, "utf-8"));
  const u1Deletes = Object.entries(u1).filter(([, v]: any) => v.delete).map(([k]) => parseInt(k));
  console.log(`Reviewer1: ${u1Deletes.length} deletes to import`);

  for (let i = 0; i < u1Deletes.length; i += 500) {
    const batch = db.batch();
    for (const photoId of u1Deletes.slice(i, i + 500)) {
      batch.set(db.collection("votes").doc(`${photoId}_reviewer1`), {
        photoId, userId: "reviewer1", action: "delete", votedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }

  const u2 = JSON.parse(readFileSync(user2Path, "utf-8"));
  const u2Deletes = Object.entries(u2).filter(([, v]: any) => v.delete).map(([k]) => parseInt(k));
  console.log(`Reviewer2: ${u2Deletes.length} deletes to import`);

  for (let i = 0; i < u2Deletes.length; i += 500) {
    const batch = db.batch();
    for (const photoId of u2Deletes.slice(i, i + 500)) {
      batch.set(db.collection("votes").doc(`${photoId}_reviewer2`), {
        photoId, userId: "reviewer2", action: "delete", votedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }

  console.log(`Done: ${photos.length} photos, ${u1Deletes.length} + ${u2Deletes.length} votes seeded.`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
