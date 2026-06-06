import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { USERS } from "../mockData";
import { usePhotos, useVotes, useLoading, loadData, toggleDelete, useCurrentUser } from "../store";

type Tab = "conflicts" | "both-deleted" | "summary";

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

export default function Consensus() {
  const navigate = useNavigate();
  const { userId, role } = useCurrentUser();
  const isLoading = useLoading();
  const photos = usePhotos();
  const votes = useVotes();

  useEffect(() => {
    if (isLoading && userId) loadData();
  }, [isLoading, userId]);
  const [tab, setTab] = useState<Tab>("summary");

  const isAdmin = role === "admin";
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

  const bothDeleted = useMemo(
    () => photos.filter((p) => r1DeleteSet.has(p.id) && r2DeleteSet.has(p.id)),
    [photos, r1DeleteSet, r2DeleteSet]
  );

  const onlyR1Deletes = useMemo(
    () => photos.filter((p) => r1DeleteSet.has(p.id) && !r2DeleteSet.has(p.id)),
    [photos, r1DeleteSet, r2DeleteSet]
  );

  const onlyR2Deletes = useMemo(
    () => photos.filter((p) => !r1DeleteSet.has(p.id) && r2DeleteSet.has(p.id)),
    [photos, r1DeleteSet, r2DeleteSet]
  );

  const neitherDeleted = photos.length - r1DeleteSet.size - r2DeleteSet.size + bothDeleted.length;
  const conflicts = [...onlyR1Deletes, ...onlyR2Deletes];

  useEffect(() => {
    if (!userId) navigate("/");
  }, [userId, navigate]);

  if (!userId) return null;
  if (isLoading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/review")}
              className="text-sm text-gray-400 hover:text-white cursor-pointer"
            >
              &larr; Grid
            </button>
            <h1 className="text-lg font-bold">Consensus Dashboard</h1>
          </div>
          {isAdmin && (
            <button
              data-testid="download-csv"
              onClick={() => downloadCsv(photos, r1DeleteSet, r2DeleteSet)}
              className="px-3 py-1.5 text-sm rounded border border-purple-500 bg-purple-600 text-white hover:bg-purple-500 cursor-pointer transition-colors"
            >
              Download CSV
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                {r1.avatar}
              </div>
              <span className="text-lg font-medium">{r1.name}</span>
            </div>
            <div className="text-4xl font-bold text-red-400">{r1DeleteSet.size}</div>
            <div className="text-sm text-gray-500 mt-1">images marked delete</div>
            <div className="mt-3 h-2 bg-gray-800 rounded-full">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${(r1DeleteSet.size / photos.length) * 100}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {((r1DeleteSet.size / photos.length) * 100).toFixed(1)}% of total
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 border border-green-900 text-center">
            <div className="text-sm text-gray-400 mb-2">Agreement</div>
            <div className="text-5xl font-bold text-green-400">{bothDeleted.length}</div>
            <div className="text-sm text-gray-500 mt-1">both agree to delete</div>
            <div className="mt-4 text-3xl font-bold text-yellow-400">{conflicts.length}</div>
            <div className="text-sm text-gray-500 mt-1">conflicts to resolve</div>
            <div className="mt-4 text-2xl font-medium text-gray-400">{neitherDeleted}</div>
            <div className="text-sm text-gray-500 mt-1">untouched by either</div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center font-bold">
                {r2.avatar}
              </div>
              <span className="text-lg font-medium">{r2.name}</span>
            </div>
            <div className="text-4xl font-bold text-orange-400">{r2DeleteSet.size}</div>
            <div className="text-sm text-gray-500 mt-1">images marked delete</div>
            <div className="mt-3 h-2 bg-gray-800 rounded-full">
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${(r2DeleteSet.size / photos.length) * 100}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {((r2DeleteSet.size / photos.length) * 100).toFixed(1)}% of total
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800 mb-6 w-fit">
          {(
            [
              ["summary", `Summary`],
              ["conflicts", `Conflicts (${conflicts.length})`],
              ["both-deleted", `Both Deleted (${bothDeleted.length})`],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-md transition-colors cursor-pointer ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "summary" && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-medium mb-4">Review Progress</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Both agree to delete</span>
                  <span className="text-green-400 font-medium">{bothDeleted.length}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full">
                  <div className="h-full bg-green-600 rounded-full" style={{ width: `${(bothDeleted.length / photos.length) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Only {r1.name} deletes</span>
                  <span className="text-red-400 font-medium">{onlyR1Deletes.length}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full">
                  <div className="h-full bg-red-600 rounded-full" style={{ width: `${(onlyR1Deletes.length / photos.length) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Only {r2.name} deletes</span>
                  <span className="text-orange-400 font-medium">{onlyR2Deletes.length}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full">
                  <div className="h-full bg-orange-600 rounded-full" style={{ width: `${(onlyR2Deletes.length / photos.length) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Kept by both (no deletes)</span>
                  <span className="text-gray-300 font-medium">{neitherDeleted}</span>
                </div>
                <div className="h-3 bg-gray-800 rounded-full">
                  <div className="h-full bg-gray-600 rounded-full" style={{ width: `${(neitherDeleted / photos.length) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "conflicts" && (
          <div className="space-y-4">
            {conflicts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No conflicts — both reviewers agree on everything reviewed so far.
              </div>
            ) : (
              conflicts.map((photo) => {
                const r1Deleted = r1DeleteSet.has(photo.id);
                return (
                  <div
                    key={photo.id}
                    className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl border border-yellow-900/50"
                  >
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.filename}
                      className="w-24 h-24 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{photo.filename}</div>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                            {r1.avatar}
                          </div>
                          <span className={`text-sm ${r1Deleted ? "text-red-400" : "text-gray-400"}`}>
                            {r1Deleted ? "DELETE" : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">
                            {r2.avatar}
                          </div>
                          <span className={`text-sm ${!r1Deleted ? "text-red-400" : "text-gray-400"}`}>
                            {!r1Deleted ? "DELETE" : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (userId && userId !== "admin") {
                              const myDeletedIt = userId === "reviewer1" ? r1Deleted : !r1Deleted;
                              if (!myDeletedIt) toggleDelete(photo.id, userId);
                            }
                          }}
                          className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 cursor-pointer transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => {
                            if (userId && userId !== "admin") {
                              const myDeletedIt = userId === "reviewer1" ? r1Deleted : !r1Deleted;
                              if (myDeletedIt) toggleDelete(photo.id, userId);
                            }
                          }}
                          className="px-4 py-2 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-colors"
                        >
                          Keep
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "both-deleted" && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Both reviewers agree these should be deleted. These are safe to remove.
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
              {bothDeleted.map((photo) => (
                <div key={photo.id} className="relative aspect-square">
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.filename}
                    className="w-full h-full object-cover rounded-sm opacity-40"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-red-500 text-lg font-bold">&times;</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
