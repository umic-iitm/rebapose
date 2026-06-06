"""
sample_frames.py — keyframe sampling for ergonomic (REBA) analysis.

Implements SAMPLING_STRATEGY.md §7 steps 1–9.

Phased pipeline (each phase writes artifacts; later phases read them, so the
script is restartable):

    filter     -> outputs/kept_clips.csv, outputs/excluded_clips.csv
    transcode  -> transcoded VFR clips, paths updated in kept_clips.csv
    shots      -> outputs/shots/{stem}.csv  (one row per shot)
    track      -> outputs/tracks/{stem}.jsonl  (one row per (frame, person))
    sample     -> outputs/picks_raw.csv  (systematic picks per stratum)
    balance    -> outputs/picks_balanced.csv  (per-worker quota applied)
    validate   -> outputs/selected_frames.csv  (FINAL deliverable)
    report     -> outputs/sampling_report.md
    all        -> run every phase in order

Run:
    python sample_frames.py --phase all
    python sample_frames.py --phase track --only "VID_20231026_*"     # subset
    python sample_frames.py --phase shots --workers 1                  # serial

Conventions:
    SEED = 42 everywhere a random choice is made.
    All times are seconds; all frame indices are 0-based.
    Clip path on disk: {ROOT}/{Foldername}/{Filename}, ROOT defaults to parent of script directory.
"""

import argparse
import csv
import fnmatch
import json
import math
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm

# ---------------------------------------------------------------------------
# constants
# ---------------------------------------------------------------------------

_SCRIPT_DIR = Path(__file__).resolve().parent

ROOT = _SCRIPT_DIR.parent           # override with --root
WORK = _SCRIPT_DIR                  # override with --work
OUT = WORK / "outputs"
SHOTS_DIR = OUT / "shots"
TRACKS_DIR = OUT / "tracks"
TRANSCODE_DIR = WORK / "transcoded_cfr"

MASTER_CSV = WORK / "video_analysis.csv"
KEPT_CSV = OUT / "kept_clips.csv"
EXCLUDED_CSV = OUT / "excluded_clips.csv"
PICKS_RAW = OUT / "picks_raw.csv"
PICKS_BAL = OUT / "picks_balanced.csv"
FINAL_CSV = OUT / "selected_frames.csv"
REPORT_MD = OUT / "sampling_report.md"


def _init_paths():
    global OUT, SHOTS_DIR, TRACKS_DIR, TRANSCODE_DIR
    global MASTER_CSV, KEPT_CSV, EXCLUDED_CSV
    global PICKS_RAW, PICKS_BAL, FINAL_CSV, REPORT_MD
    OUT = WORK / "outputs"
    SHOTS_DIR = OUT / "shots"
    TRACKS_DIR = OUT / "tracks"
    TRANSCODE_DIR = WORK / "transcoded_cfr"
    MASTER_CSV = WORK / "video_analysis.csv"
    KEPT_CSV = OUT / "kept_clips.csv"
    EXCLUDED_CSV = OUT / "excluded_clips.csv"
    PICKS_RAW = OUT / "picks_raw.csv"
    PICKS_BAL = OUT / "picks_balanced.csv"
    FINAL_CSV = OUT / "selected_frames.csv"
    REPORT_MD = OUT / "sampling_report.md"

SEED = 42
SAMPLE_INTERVAL_S = 3.0          # T in §3.2
N_MIN_PER_WORKER = 10            # §3.3
N_MAX_PER_WORKER = 200
MIN_BBOX_HEIGHT = 80             # px, §2 + §3.4
MIN_STRATUM_SECONDS = 2.0        # §5 step
BLUR_THRESHOLD = 100.0           # Laplacian variance, §3.4
SHOT_BOUNDARY_PAD = 5            # frames, §3.4
SCENE_THRESHOLD = 27.0           # PySceneDetect ContentDetector
YOLO_MODEL = "yolov8s.pt"
YOLO_IMGSZ = 640                 # tracking resolution; raised on demand for QC
YOLO_CONF = 0.35
YOLO_IOU = 0.5

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def clip_path(folder: str, filename: str) -> Path:
    return ROOT / folder / filename


def stem_id(folder: str, filename: str) -> str:
    """Unique stable id for a clip across phases (folder prefix avoids collisions)."""
    folder_prefix = folder.split("_", 1)[0]  # "1", "2", ...
    return f"{folder_prefix}_{Path(filename).stem}"


def ensure_dirs():
    for d in (OUT, SHOTS_DIR, TRACKS_DIR, TRANSCODE_DIR):
        d.mkdir(parents=True, exist_ok=True)


def is_whatsapp(row) -> bool:
    """WhatsApp re-encode detection.

    Match any of:
      - filename contains 'whatsapp' (case-insensitive), or
      - filename has a 'WA' token (e.g. VID-YYYYMMDD-WA0001.mp4), or
      - (resolution in {720x1280, 1280x720}) AND h264 AND bitrate<3500 AND no GPS.

    Bitrate bumped from 3000 -> 3500: WhatsApp's typical output clusters at
    3000-3100 kbps; 3000 was too tight (2 clips at 3024/3026 slipped through).
    Native phone 720p on this corpus runs ~8+ Mbps, so 3500 is still safely
    separating re-encode from original capture.
    """
    fn_raw = str(row["Filename"])
    fn_lo = fn_raw.lower()
    if "whatsapp" in fn_lo:
        return True
    if "WA" in re.split(r"[_\-.]", fn_raw.upper()):
        return True
    res = str(row.get("Resolution", ""))
    codec = str(row.get("VideoCodec", "")).lower()
    try:
        br = int(row.get("VideoBitrate(kbps)", 0) or 0)
    except (ValueError, TypeError):
        br = 0
    has_gps = bool(str(row.get("Latitude", "")).strip()) and bool(str(row.get("Longitude", "")).strip())
    is_720x1280 = res in ("720*1280", "1280*720")
    return is_720x1280 and codec in ("h264", "avc1") and br < 3500 and not has_gps


# ---------------------------------------------------------------------------
# Step 1 — clip filters
# ---------------------------------------------------------------------------


def phase_filter():
    df = pd.read_csv(MASTER_CSV)
    kept, excluded = [], []

    for _, r in df.iterrows():
        try:
            dur = float(r["Duration(s)"])
        except (ValueError, TypeError):
            dur = 0.0

        reason = None
        if dur < 10:
            reason = f"duration<10s ({dur:.1f})"
        elif is_whatsapp(r):
            reason = "whatsapp_origin"
        elif dur < 30:
            # Defer: §2 says "keep only if worker-present fraction > 50%".
            # We can't know that until tracking; flag for a second-pass review
            # after track phase. For now, keep and tag.
            pass

        rec = r.to_dict()
        rec["stem_id"] = stem_id(r["Foldername"], r["Filename"])
        rec["src_path"] = str(clip_path(r["Foldername"], r["Filename"]))
        rec["work_path"] = rec["src_path"]      # may be overwritten by transcode
        rec["short_clip"] = "yes" if dur < 30 else "no"
        if reason:
            rec["exclusion_reason"] = reason
            excluded.append(rec)
        else:
            kept.append(rec)

    pd.DataFrame(kept).to_csv(KEPT_CSV, index=False)
    pd.DataFrame(excluded).to_csv(EXCLUDED_CSV, index=False)
    print(f"[filter] kept={len(kept)}  excluded={len(excluded)}  -> {KEPT_CSV.name}, {EXCLUDED_CSV.name}")


# ---------------------------------------------------------------------------
# Step 2 — VFR -> CFR transcode
# ---------------------------------------------------------------------------


def phase_transcode():
    df = pd.read_csv(KEPT_CSV)
    vfr_mask = df["VFR"].astype(str).str.lower() == "yes"
    targets = df[vfr_mask]
    if targets.empty:
        print("[transcode] no VFR clips to transcode")
        return

    for _, r in tqdm(targets.iterrows(), total=len(targets), desc="transcoding"):
        src = Path(r["src_path"])
        dst = TRANSCODE_DIR / f"{r['stem_id']}.mp4"
        if dst.exists():
            df.loc[df["stem_id"] == r["stem_id"], "work_path"] = str(dst)
            continue
        cmd = [
            "ffmpeg", "-y", "-i", str(src),
            "-r", "30", "-vsync", "cfr",
            "-c:v", "libx264", "-crf", "18",
            "-c:a", "copy",
            str(dst),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[transcode] FAILED {r['stem_id']}: {res.stderr.splitlines()[-1] if res.stderr else '?'}")
            continue
        df.loc[df["stem_id"] == r["stem_id"], "work_path"] = str(dst)

    df.to_csv(KEPT_CSV, index=False)
    print(f"[transcode] updated work_path for {len(targets)} clips")


# ---------------------------------------------------------------------------
# Step 3 — shot segmentation
# ---------------------------------------------------------------------------


def phase_shots(only=None):
    from scenedetect import detect, ContentDetector

    df = pd.read_csv(KEPT_CSV)
    if only:
        df = df[df["Filename"].apply(lambda f: fnmatch.fnmatch(f, only))]

    for _, r in tqdm(df.iterrows(), total=len(df), desc="shots"):
        out = SHOTS_DIR / f"{r['stem_id']}.csv"
        if out.exists():
            continue
        try:
            scenes = detect(r["work_path"], ContentDetector(threshold=SCENE_THRESHOLD))
        except Exception as e:
            print(f"[shots] FAILED {r['stem_id']}: {e}")
            continue
        rows = []
        for i, (s, e) in enumerate(scenes):
            rows.append({
                "shot_id": i,
                "start_frame": s.frame_num,
                "end_frame": e.frame_num,
                "start_s": s.get_seconds(),
                "end_s": e.get_seconds(),
            })
        # If the detector returned nothing, treat the whole clip as one shot.
        if not rows:
            cap = cv2.VideoCapture(r["work_path"])
            n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            cap.release()
            rows = [{"shot_id": 0, "start_frame": 0, "end_frame": n,
                     "start_s": 0.0, "end_s": n / fps}]
        pd.DataFrame(rows).to_csv(out, index=False)


# ---------------------------------------------------------------------------
# Step 4 — detection + tracking (YOLOv8s + ByteTrack)
# ---------------------------------------------------------------------------


def phase_track(only=None):
    from ultralytics import YOLO

    df = pd.read_csv(KEPT_CSV)
    if only:
        df = df[df["Filename"].apply(lambda f: fnmatch.fnmatch(f, only))]

    model = YOLO(YOLO_MODEL)

    for _, r in tqdm(df.iterrows(), total=len(df), desc="tracking"):
        out = TRACKS_DIR / f"{r['stem_id']}.jsonl"
        if out.exists():
            continue
        results = model.track(
            r["work_path"],
            classes=[0],          # person only
            tracker="bytetrack.yaml",
            imgsz=YOLO_IMGSZ,
            conf=YOLO_CONF,
            iou=YOLO_IOU,
            persist=False,
            stream=True,
            verbose=False,
            device=0,
        )
        with out.open("w", buffering=1) as f:
            for frame_idx, res in enumerate(tqdm(results, desc=f"  {r['stem_id']}", leave=False, unit="f")):
                if res.boxes is None or res.boxes.id is None:
                    continue
                ids = res.boxes.id.cpu().int().tolist()
                xyxy = res.boxes.xyxy.cpu().numpy()
                confs = res.boxes.conf.cpu().numpy()
                for tid, (x1, y1, x2, y2), c in zip(ids, xyxy, confs):
                    f.write(json.dumps({
                        "frame": frame_idx,
                        "track_id": int(tid),
                        "x1": float(x1), "y1": float(y1),
                        "x2": float(x2), "y2": float(y2),
                        "conf": float(c),
                    }) + "\n")


# ---------------------------------------------------------------------------
# Step 5+6 — strata + systematic sampling
# ---------------------------------------------------------------------------


def load_tracks(stem):
    p = TRACKS_DIR / f"{stem}.jsonl"
    if not p.exists():
        return pd.DataFrame(columns=["frame", "track_id", "x1", "y1", "x2", "y2", "conf"])
    return pd.read_json(p, lines=True)


def load_shots(stem):
    p = SHOTS_DIR / f"{stem}.csv"
    if not p.exists():
        return pd.DataFrame(columns=["shot_id", "start_frame", "end_frame", "start_s", "end_s"])
    return pd.read_csv(p)


def get_fps(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.release()
    return fps


def phase_sample():
    df = pd.read_csv(KEPT_CSV)
    rng = np.random.default_rng(SEED)
    rows = []

    for _, r in tqdm(df.iterrows(), total=len(df), desc="sampling"):
        stem = r["stem_id"]
        shots = load_shots(stem)
        tracks = load_tracks(stem)
        if shots.empty or tracks.empty:
            continue
        fps = get_fps(r["work_path"])
        T_frames = max(1, int(round(SAMPLE_INTERVAL_S * fps)))

        # filter tracks by min bbox height (§2/§3.4)
        tracks = tracks[(tracks["y2"] - tracks["y1"]) >= MIN_BBOX_HEIGHT].copy()
        if tracks.empty:
            continue

        # assign each track-frame to its shot
        # (vectorised: sort shots by start_frame and use searchsorted)
        shots_sorted = shots.sort_values("start_frame").reset_index(drop=True)
        starts = shots_sorted["start_frame"].to_numpy()
        idx = np.searchsorted(starts, tracks["frame"].to_numpy(), side="right") - 1
        idx = np.clip(idx, 0, len(shots_sorted) - 1)
        tracks["shot_id"] = shots_sorted.loc[idx, "shot_id"].to_numpy()

        # build strata = (shot_id, track_id)
        for (shot_id, track_id), grp in tracks.groupby(["shot_id", "track_id"]):
            frames = np.sort(grp["frame"].unique())
            stratum_dur = (frames[-1] - frames[0]) / fps
            if stratum_dur < MIN_STRATUM_SECONDS:
                continue

            # systematic with random start (§3.2)
            u = rng.uniform(0, T_frames)
            picks_target = frames[0] + u + np.arange(0,
                                                     int((frames[-1] - frames[0]) // T_frames) + 1) * T_frames
            # snap to nearest available frame in this stratum
            for tgt in picks_target:
                j = np.searchsorted(frames, tgt)
                if j >= len(frames):
                    j = len(frames) - 1
                # also consider j-1, pick closer
                if j > 0 and abs(frames[j - 1] - tgt) < abs(frames[j] - tgt):
                    j = j - 1
                fnum = int(frames[j])
                bb = grp[grp["frame"] == fnum].iloc[0]
                rows.append({
                    "stem_id": stem,
                    "folder": r["Foldername"],
                    "filename": r["Filename"],
                    "sitename": r["Sitename"],
                    "work_path": r["work_path"],
                    "fps": fps,
                    "shot_id": int(shot_id),
                    "track_id": int(track_id),
                    "frame_idx": fnum,
                    "timestamp_s": fnum / fps,
                    "x1": float(bb["x1"]), "y1": float(bb["y1"]),
                    "x2": float(bb["x2"]), "y2": float(bb["y2"]),
                    "conf": float(bb["conf"]),
                })

    pd.DataFrame(rows).drop_duplicates(
        subset=["stem_id", "track_id", "frame_idx"]
    ).to_csv(PICKS_RAW, index=False)
    print(f"[sample] wrote {len(rows)} raw picks -> {PICKS_RAW.name}")


# ---------------------------------------------------------------------------
# Step 7 — per-worker balancing
# ---------------------------------------------------------------------------


def phase_balance():
    df = pd.read_csv(PICKS_RAW)
    if df.empty:
        print("[balance] picks_raw is empty; skipping")
        df.to_csv(PICKS_BAL, index=False)
        return
    rng = np.random.default_rng(SEED)

    # global worker key = (stem_id, track_id)  — per §4 Option 1
    df["worker_key"] = df["stem_id"].astype(str) + "::" + df["track_id"].astype(str)

    out_chunks = []
    counts_before = df.groupby("worker_key").size()

    # cap at N_MAX_PER_WORKER
    for key, grp in df.groupby("worker_key"):
        if len(grp) > N_MAX_PER_WORKER:
            grp = grp.sample(n=N_MAX_PER_WORKER, random_state=SEED)
        out_chunks.append(grp)
    capped = pd.concat(out_chunks, ignore_index=True)

    # Top-up under-represented workers by additionally sampling at T/2.
    # Implementation: re-run §3.2 at half the interval *only* for these workers.
    # Done lazily here: we just flag them; topping up requires re-reading tracks.
    counts_after = capped.groupby("worker_key").size()
    under = counts_after[counts_after < N_MIN_PER_WORKER].index.tolist()

    if under:
        print(f"[balance] {len(under)} workers under N_min={N_MIN_PER_WORKER}; topping up at T/2")
        # cheap top-up: read each under-worker's tracks again at T/2 interval
        topup = []
        for key in under:
            stem, tid = key.split("::")
            tid = int(tid)
            tracks = load_tracks(stem)
            if tracks.empty:
                continue
            tracks = tracks[(tracks["track_id"] == tid)
                            & ((tracks["y2"] - tracks["y1"]) >= MIN_BBOX_HEIGHT)]
            if tracks.empty:
                continue
            row0 = df[df["worker_key"] == key].iloc[0]
            fps = float(row0["fps"])
            T_half = max(1, int(round(SAMPLE_INTERVAL_S / 2 * fps)))
            frames = np.sort(tracks["frame"].unique())
            u = rng.uniform(0, T_half)
            targets = frames[0] + u + np.arange(0, int((frames[-1] - frames[0]) // T_half) + 1) * T_half
            existing = set(df[df["worker_key"] == key]["frame_idx"].tolist())
            for tgt in targets:
                j = np.searchsorted(frames, tgt)
                if j >= len(frames):
                    j = len(frames) - 1
                fnum = int(frames[j])
                if fnum in existing:
                    continue
                bb = tracks[tracks["frame"] == fnum].iloc[0]
                topup.append({**row0.to_dict(),
                              "frame_idx": fnum,
                              "timestamp_s": fnum / fps,
                              "x1": float(bb["x1"]), "y1": float(bb["y1"]),
                              "x2": float(bb["x2"]), "y2": float(bb["y2"]),
                              "conf": float(bb["conf"])})
                existing.add(fnum)
                if len(existing) >= N_MIN_PER_WORKER:
                    break
        if topup:
            capped = pd.concat([capped, pd.DataFrame(topup)], ignore_index=True)

    capped = capped.drop_duplicates(subset=["stem_id", "track_id", "frame_idx"])
    capped.to_csv(PICKS_BAL, index=False)
    print(f"[balance] {len(df)} -> {len(capped)} picks; "
          f"workers: {counts_before.size}; "
          f"min/median/max per worker: "
          f"{capped.groupby('worker_key').size().min()}/"
          f"{int(capped.groupby('worker_key').size().median())}/"
          f"{capped.groupby('worker_key').size().max()}  -> {PICKS_BAL.name}")


# ---------------------------------------------------------------------------
# Step 8 — quality gate (blur + shot-boundary distance)
# ---------------------------------------------------------------------------


def laplacian_var(frame_bgr) -> float:
    g = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(g, cv2.CV_64F).var())


def phase_validate():
    df = pd.read_csv(PICKS_BAL)
    if df.empty:
        print("[validate] picks_balanced is empty")
        return

    # pre-load shot boundaries per clip for fast cut-distance check
    boundaries = {}
    for stem in df["stem_id"].unique():
        s = load_shots(stem)
        b = sorted(set(s["start_frame"].tolist() + s["end_frame"].tolist()))
        boundaries[stem] = np.array(b, dtype=int)

    keep_rows = []
    blur_scores = []
    for stem, grp in tqdm(df.groupby("stem_id"), desc="validating"):
        path = grp.iloc[0]["work_path"]
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            print(f"[validate] cannot open {path}")
            continue
        bnds = boundaries.get(stem, np.array([]))
        # iterate in frame order for fast sequential reads
        grp_sorted = grp.sort_values("frame_idx")
        cur = -1
        for _, r in grp_sorted.iterrows():
            target = int(r["frame_idx"])
            # shot-boundary pad
            if bnds.size and np.min(np.abs(bnds - target)) < SHOT_BOUNDARY_PAD:
                continue
            if target != cur + 1:
                cap.set(cv2.CAP_PROP_POS_FRAMES, target)
            ok, frame = cap.read()
            cur = target
            if not ok:
                continue
            bv = laplacian_var(frame)
            if bv < BLUR_THRESHOLD:
                continue
            d = r.to_dict()
            d["blur_score"] = bv
            keep_rows.append(d)
            blur_scores.append(bv)
        cap.release()

    final = pd.DataFrame(keep_rows)
    # final column order
    cols = ["stem_id", "folder", "filename", "sitename", "work_path", "fps",
            "shot_id", "track_id", "worker_key",
            "frame_idx", "timestamp_s",
            "x1", "y1", "x2", "y2", "conf", "blur_score"]
    final = final.reindex(columns=[c for c in cols if c in final.columns])
    final.to_csv(FINAL_CSV, index=False)
    print(f"[validate] {len(df)} -> {len(final)} frames after blur+boundary gate -> {FINAL_CSV.name}")


# ---------------------------------------------------------------------------
# Step 9 — sampling report
# ---------------------------------------------------------------------------


def phase_report():
    if not FINAL_CSV.exists():
        print("[report] selected_frames.csv missing; run validate first")
        return
    df = pd.read_csv(FINAL_CSV)
    excluded = pd.read_csv(EXCLUDED_CSV) if EXCLUDED_CSV.exists() else pd.DataFrame()
    kept = pd.read_csv(KEPT_CSV) if KEPT_CSV.exists() else pd.DataFrame()

    lines = []
    lines.append("# Sampling report\n")
    lines.append(f"- Master clips: {len(kept) + len(excluded)}")
    lines.append(f"- Kept after filters: {len(kept)}")
    lines.append(f"- Excluded: {len(excluded)}")
    if not excluded.empty:
        for reason, n in excluded["exclusion_reason"].value_counts().items():
            lines.append(f"    - {reason}: {n}")
    lines.append(f"- Final frames selected: {len(df)}")
    lines.append("")
    lines.append("## Frames per site")
    for site, n in df.groupby("sitename").size().sort_values(ascending=False).items():
        lines.append(f"- {site}: {n}")
    lines.append("")
    lines.append("## Frames per worker (top 20)")
    wc = df.groupby("worker_key").size().sort_values(ascending=False)
    for wk, n in wc.head(20).items():
        lines.append(f"- {wk}: {n}")
    lines.append("")
    lines.append(f"## Worker quota stats")
    lines.append(f"- workers: {wc.size}")
    lines.append(f"- min/median/max frames per worker: {wc.min()}/{int(wc.median())}/{wc.max()}")
    lines.append("")
    lines.append("## Blur score distribution")
    bs = df["blur_score"].describe()
    lines.append(f"- {bs.to_dict()}")

    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[report] -> {REPORT_MD.name}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


PHASES = {
    "filter":    phase_filter,
    "transcode": phase_transcode,
    "shots":     phase_shots,
    "track":     phase_track,
    "sample":    phase_sample,
    "balance":   phase_balance,
    "validate":  phase_validate,
    "report":    phase_report,
}


def main():
    ap = argparse.ArgumentParser(
        description="Keyframe sampling pipeline for multi-person REBA ergonomic analysis.")
    ap.add_argument("--phase", required=True,
                    choices=list(PHASES.keys()) + ["all"])
    ap.add_argument("--only", default=None,
                    help="glob on Filename for shots/track phases (e.g. 'VID_2023*')")
    ap.add_argument("--root", type=str, default=None,
                    help="root directory containing site video folders "
                         "(default: parent of script directory)")
    ap.add_argument("--work", type=str, default=None,
                    help="working directory for metadata CSV and outputs "
                         "(default: script directory)")
    args = ap.parse_args()

    global ROOT, WORK
    if args.root:
        ROOT = Path(args.root)
    if args.work:
        WORK = Path(args.work)
    _init_paths()
    ensure_dirs()

    if args.phase == "all":
        order = ["filter", "transcode", "shots", "track",
                 "sample", "balance", "validate", "report"]
    else:
        order = [args.phase]

    for p in order:
        fn = PHASES[p]
        kwargs = {}
        if p in ("shots", "track") and args.only:
            kwargs["only"] = args.only
        print(f"\n=== phase: {p} ===")
        fn(**kwargs)


if __name__ == "__main__":
    main()
