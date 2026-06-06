"""
dump_all_selected_frames.py — extract every frame listed in a CSV manifest
to disk as JPG (or PNG).

Efficient: opens each video ONCE, seeks frames in ascending order, writes
images. Restartable: skips files that already exist.

Filename convention (unique per worker-row):
    {stem_id}__f{frame_idx:06d}__t{track_id:03d}.jpg

Run:
    python dump_all_selected_frames.py
    python dump_all_selected_frames.py --csv selected_frames_tasks.csv --annotate
    python dump_all_selected_frames.py --csv selected_frames_tasks.csv --crop --annotate
    python dump_all_selected_frames.py --format png
    python dump_all_selected_frames.py --site "1_" --jpg-quality 92
    python dump_all_selected_frames.py --dry-run

    REBAPose (requires REBAPose dependencies):
    python dump_all_selected_frames.py --csv selected_frames_tasks.csv --annotate --reba

Annotation auto-detects the 'task' column: if present in the CSV, it is
included in the caption; if absent, the caption shows only Frame & Worker.
"""

import argparse
import json
import time
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm

_SCRIPT_DIR = Path(__file__).resolve().parent
WORK = _SCRIPT_DIR
FINAL_CSV = WORK / "outputs" / "selected_frames.csv"
DEFAULT_OUT = WORK / "outputs" / "frames"


def fname(row, ext):
    stem = row.get("stem_id") or Path(str(row["work_path"])).stem
    return f"{stem}__f{int(row['frame_idx']):06d}__t{int(row.get('track_id', 0)):03d}.{ext}"


def iou(box_a, box_b):
    xa = max(box_a[0], box_b[0]); ya = max(box_a[1], box_b[1])
    xb = min(box_a[2], box_b[2]); yb = min(box_a[3], box_b[3])
    inter = max(0, xb - xa) * max(0, yb - ya)
    area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
    area_b = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
    return inter / (area_a + area_b - inter + 1e-6)


def run_reba_on_frame(reba_processor, img, csv_bbox):
    """Run REBAPose on a copy of img, match target person to csv_bbox,
    draw only that person's skeleton on the original img.
    Returns (score_c, person_num, pose_conf, person_json) or (None, -1, None, None)."""
    result = reba_processor.process_frame(img.copy(), frame_num=None)
    persons = result['persons']
    if not persons:
        return None, -1, None, None

    best_idx, best_iou = -1, -1.0
    for pidx, person in enumerate(persons):
        kpts = person['keypoints']
        xs = [v[0] for v in kpts.values()]
        ys = [v[1] for v in kpts.values()]
        det_bbox = (min(xs), min(ys), max(xs), max(ys))
        score = iou(csv_bbox, det_bbox)
        if score > best_iou:
            best_iou = score
            best_idx = pidx

    if best_idx < 0 or best_iou < 0.1:
        return None, -1, None, None

    matched = persons[best_idx]
    score_c = matched['reba']['aggregateScore']['ScoreC']

    kpt_scores = matched.get('keypoint_scores')
    pose_conf = round(float(np.mean(kpt_scores)), 2) if kpt_scores else None

    kpts_2d_dict = matched['keypoints']
    kpts_array = np.zeros((18, 2))
    for name, idx in reba_processor.POINTS.items():
        kpts_array[idx] = kpts_2d_dict[name][:2]

    skeleton_color = reba_processor._get_skeleton_color(score_c)
    reba_processor._draw_skeleton(img, kpts_array, skeleton_color)

    return score_c, best_idx, pose_conf, matched


def annotate(img, row, crop_offset=None, has_task=False,
             reba_score_c=None, pose_conf=None):
    """Draw bbox + caption on the image.

    crop_offset: (ox, oy) if image was cropped — bbox coords are shifted
                 so they land correctly on the cropped region.  None for
                 full-frame images.
    has_task:    True if the CSV has a 'task' column — appends task name
                to the caption automatically.
    """
    h, w = img.shape[:2]
    track_id = int(row.get("track_id", 0))
    frame_idx = int(row["frame_idx"])
    caption = f"Frame {frame_idx} | Worker {track_id}"

    if has_task:
        task_val = row.get("task", "")
        if pd.notna(task_val) and str(task_val).strip():
            caption += f" | {task_val}"

    if reba_score_c is not None:
        caption += f" | Score C: {reba_score_c}"
        if pose_conf is not None:
            caption += f" | Conf: {pose_conf}"

    bbox_cols = {"x1", "y1", "x2", "y2"}
    if bbox_cols.issubset(row.index) and not row[list(bbox_cols)].isna().any():
        bx1, by1, bx2, by2 = (int(row[c]) for c in ("x1", "y1", "x2", "y2"))
        if crop_offset is not None:
            ox, oy = crop_offset
            bx1 -= ox; by1 -= oy; bx2 -= ox; by2 -= oy
        cv2.rectangle(img, (bx1, by1), (bx2, by2), (0, 255, 0), 2)

    scale = max(0.4, w / 1280 * 0.6)
    thickness = max(1, int(scale * 2))
    (tw, th), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    cv2.rectangle(img, (0, 0), (tw + 10, th + 14), (0, 0, 0), -1)
    cv2.putText(img, caption, (5, th + 7), cv2.FONT_HERSHEY_SIMPLEX, scale,
                (255, 255, 255), thickness, cv2.LINE_AA)
    return img


def crop_bbox(img, row, pad=0.1):
    h, w = img.shape[:2]
    x1 = int(row["x1"]); y1 = int(row["y1"])
    x2 = int(row["x2"]); y2 = int(row["y2"])
    bw, bh = x2 - x1, y2 - y1
    cx1 = max(0, int(x1 - pad * bw))
    cy1 = max(0, int(y1 - pad * bh))
    cx2 = min(w, int(x2 + pad * bw))
    cy2 = min(h, int(y2 + pad * bh))
    return img[cy1:cy2, cx1:cx2], (cx1, cy1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=str, default=str(FINAL_CSV),
                    help="input manifest (default: outputs/selected_frames.csv)")
    ap.add_argument("--out", type=str, default=str(DEFAULT_OUT),
                    help="output directory (default: outputs/frames)")
    ap.add_argument("--format", choices=["jpg", "png"], default="jpg",
                    help="image format (jpg much smaller; png lossless)")
    ap.add_argument("--jpg-quality", type=int, default=95, help="JPEG quality 1-100")
    ap.add_argument("--crop", action="store_true",
                    help="save bbox crop (with 10%% pad) instead of full frame")
    ap.add_argument("--annotate", action="store_true",
                    help="embed 'Frame N | Worker N' caption + green bounding "
                         "box on image (both crop and full-frame modes)")
    ap.add_argument("--site", type=str, default=None,
                    help="substring filter on sitename/folder/stem_id")
    ap.add_argument("--overwrite", action="store_true",
                    help="re-extract even if file exists")
    ap.add_argument("--dry-run", action="store_true",
                    help="print plan only, do not write files")
    ap.add_argument("--bbox-only", action="store_true",
                    help="draw green bounding box only (no caption, no REBA "
                         "skeleton) — useful for documentation side-by-side")
    ap.add_argument("--reba", action="store_true",
                    help="run REBAPose REBA scoring + skeleton overlay on each "
                         "frame (requires rebapaper venv)")
    args = ap.parse_args()

    reba_processor = None
    if args.reba:
        import sys
        sys.path.insert(0, str(WORK.parent / "REBAPose"))
        try:
            from REBAPose import REBAPose as _REBAPose
        except ImportError as e:
            raise SystemExit(
                f"--reba requires REBAPose and its dependencies (PyTorch, MMPose). "
                f"Ensure REBAPose/ is in the parent directory and the correct "
                f"Python environment is active.\n"
                f"Import error: {e}"
            )
        print("[dump] loading REBAPose models (this may take a moment)...")
        reba_processor = _REBAPose(
            input_images_path=".",
            output_path=str(Path(args.out)),
            annotation=False,
        )
        print("[dump] REBAPose ready")

    csv_path = Path(args.csv)
    out_dir = Path(args.out)
    if not csv_path.exists():
        raise SystemExit(f"missing {csv_path} — run --phase validate first")
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(csv_path)
    if args.site:
        mask = pd.Series(False, index=df.index)
        for col in ("sitename", "folder", "stem_id"):
            if col in df.columns:
                mask |= df[col].astype(str).str.contains(args.site, case=False, na=False)
        df = df[mask]
    if df.empty:
        raise SystemExit("no rows match filter")

    need_crop_cols = {"x1", "y1", "x2", "y2"}
    if args.crop and not need_crop_cols.issubset(df.columns):
        raise SystemExit(f"--crop requires columns {need_crop_cols} in CSV")

    has_task = "task" in df.columns
    if has_task:
        print(f"[dump] 'task' column detected — will include in annotations")
    else:
        print(f"[dump] no 'task' column — annotations will show Frame & Worker only")

    ext = args.format
    write_params = [cv2.IMWRITE_JPEG_QUALITY, int(args.jpg_quality)] if ext == "jpg" else []

    # group by clip → sequential seek per clip
    groups = list(df.groupby("work_path", sort=False))
    print(f"[dump] {len(df)} rows across {len(groups)} clips -> {out_dir}")
    if args.dry_run:
        for clip, grp in groups[:5]:
            print(f"  {clip}: {len(grp)} frames")
        print(f"  ... ({len(groups)} clips total)" if len(groups) > 5 else "")
        return

    reba_results = {}
    jsons_dir = None
    if reba_processor is not None:
        jsons_dir = out_dir / "jsons"
        jsons_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    written = skipped = failed = 0

    for clip, grp in tqdm(groups, desc="clips"):
        grp = grp.sort_values("frame_idx")

        # check which rows need extraction
        out_paths = [out_dir / fname(r, ext) for _, r in grp.iterrows()]
        todo = [i for i, p in enumerate(out_paths) if args.overwrite or not p.exists()]
        skipped += len(grp) - len(todo)
        if not todo:
            continue

        cap = cv2.VideoCapture(str(clip))
        if not cap.isOpened():
            print(f"  [fail-open] {clip}")
            failed += len(todo)
            continue

        for i in todo:
            row = grp.iloc[i]
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(row["frame_idx"]))
            ok, img = cap.read()
            if not ok or img is None:
                failed += 1
                continue

            reba_score_c = None
            pose_conf = None
            person_json = None
            if reba_processor is not None:
                bbox_cols = {"x1", "y1", "x2", "y2"}
                if bbox_cols.issubset(row.index) and not row[list(bbox_cols)].isna().any():
                    csv_bbox = tuple(int(row[c]) for c in ("x1", "y1", "x2", "y2"))
                    try:
                        reba_score_c, _, pose_conf, person_json = run_reba_on_frame(
                            reba_processor, img, csv_bbox)
                    except Exception as e:
                        print(f"  [reba-fail] frame {int(row['frame_idx'])}: {e}")
                reba_results[row.name] = (reba_score_c, pose_conf)

            if args.crop:
                img, crop_origin = crop_bbox(img, row)
                if img.size == 0:
                    failed += 1
                    continue
                if args.annotate:
                    img = annotate(img, row, crop_offset=crop_origin, has_task=has_task,
                                   reba_score_c=reba_score_c, pose_conf=pose_conf)
                elif args.bbox_only:
                    bbox_cols = {"x1", "y1", "x2", "y2"}
                    if bbox_cols.issubset(row.index) and not row[list(bbox_cols)].isna().any():
                        ox, oy = crop_origin
                        bx1, by1, bx2, by2 = (int(row[c]) for c in ("x1", "y1", "x2", "y2"))
                        cv2.rectangle(img, (bx1 - ox, by1 - oy), (bx2 - ox, by2 - oy), (0, 255, 0), 2)
            elif args.annotate:
                img = annotate(img, row, crop_offset=None, has_task=has_task,
                               reba_score_c=reba_score_c, pose_conf=pose_conf)
            elif args.bbox_only:
                bbox_cols = {"x1", "y1", "x2", "y2"}
                if bbox_cols.issubset(row.index) and not row[list(bbox_cols)].isna().any():
                    bx1, by1, bx2, by2 = (int(row[c]) for c in ("x1", "y1", "x2", "y2"))
                    cv2.rectangle(img, (bx1, by1), (bx2, by2), (0, 255, 0), 2)
            ok = cv2.imwrite(str(out_paths[i]), img, write_params)
            if ok:
                written += 1
                if person_json is not None and jsons_dir is not None:
                    json_path = jsons_dir / f"{out_paths[i].stem}.json"
                    with open(json_path, "w") as f:
                        json.dump(person_json, f, indent=2)
            else:
                failed += 1

        cap.release()

    dt = time.time() - t0
    print(f"[dump] done in {dt/60:.1f} min — written={written} skipped={skipped} failed={failed}")
    print(f"[dump] output: {out_dir}")

    if reba_processor is not None and reba_results:
        df["ScoreC"] = df.index.map(lambda idx: reba_results[idx][0] if idx in reba_results else None)
        df["Confidence"] = df.index.map(lambda idx: reba_results[idx][1] if idx in reba_results else None)
        out_csv = csv_path.parent / "selected_frames_tasks_rebascores.csv"
        df.to_csv(out_csv, index=False)
        print(f"[dump] REBA CSV: {out_csv}")


if __name__ == "__main__":
    main()
