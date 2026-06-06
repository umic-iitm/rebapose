import argparse
import os, csv, subprocess, json, re
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = str(_SCRIPT_DIR.parent)
# Replace with your own site folder names under ROOT.
# Each folder should contain video clips from one construction/demolition site.
FOLDERS = [
    "1_26102023_SiteA_Building1",
    "2_13122023_SiteA_Building1",
    "3_14122023_SiteB_UtilityBldg",
    "4_18012024_SiteA_Building2",
    "5_13032024_SiteB_AdminBldg",
    "6_28052024_SiteC_IndustrialUnit",
    "7_SiteD_CommercialConstruction",
    "8_SiteE_ServiceStation",
]
VIDEO_EXT = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".m4v", ".3gp", ".mpg", ".mpeg", ".webm"}

def sitename(folder):
    m = re.match(r"^\d+_(?:\d{8}_)?(.*)$", folder)
    return m.group(1) if m else folder

def parse_rate(fr):
    try:
        n, d = fr.split("/")
        n, d = float(n), float(d)
        if d == 0:
            return None
        return n / d
    except Exception:
        return None

def parse_iso6709(loc):
    # e.g. "+21.1636+072.7859/" or "+21.1636+072.7859+000.000/"
    if not loc:
        return "", ""
    m = re.findall(r"([+-]\d+(?:\.\d+)?)", loc)
    if len(m) >= 2:
        return m[0], m[1]
    return "", ""

def probe(path):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path],
        capture_output=True, text=True
    )
    try:
        j = json.loads(r.stdout)
    except Exception:
        return {}

    streams = j.get("streams", [])
    fmt = j.get("format", {})
    vs = next((s for s in streams if s.get("codec_type") == "video"), {})
    aus = [s for s in streams if s.get("codec_type") == "audio"]
    a0 = aus[0] if aus else {}

    w = vs.get("width"); h = vs.get("height")
    dur = vs.get("duration") or fmt.get("duration")
    dur = float(dur) if dur else 0

    avg = parse_rate(vs.get("avg_frame_rate", "0/0"))
    rfr = parse_rate(vs.get("r_frame_rate", "0/0"))
    nbf = vs.get("nb_frames")
    nb_fps = None
    if nbf and dur:
        try:
            nb_fps = float(nbf) / dur
        except Exception:
            pass
    candidates = [avg, nb_fps, rfr]
    fps = next((c for c in candidates if c is not None and 0 < c <= 1000), 0)
    fps = round(fps, 3) if fps else 0

    # VFR: avg differs meaningfully from r_frame_rate
    vfr = ""
    if avg and rfr and rfr <= 1000:
        vfr = "yes" if abs(avg - rfr) / max(avg, rfr) > 0.02 else "no"
    elif avg and rfr and rfr > 1000:
        vfr = "yes"

    # Rotation: prefer side_data, fall back to tag
    rotation = ""
    for sd in vs.get("side_data_list", []) or []:
        if "rotation" in sd:
            rotation = sd["rotation"]
            break
    if rotation == "":
        rotation = vs.get("tags", {}).get("rotate", "")

    rot_int = 0
    try:
        rot_int = int(rotation) if rotation != "" else 0
    except Exception:
        rot_int = 0

    # Effective orientation accounts for rotation
    eff_w, eff_h = w, h
    if rot_int in (90, -90, 270, -270) and w and h:
        eff_w, eff_h = h, w
    orient = "portrait" if eff_h and eff_w and eff_h > eff_w else "landscape"
    resolution = f"{w}*{h}" if w and h else ""

    # Creation timestamp
    creation = vs.get("tags", {}).get("creation_time") or fmt.get("tags", {}).get("creation_time", "")

    # GPS
    loc = fmt.get("tags", {}).get("location") or fmt.get("tags", {}).get("com.apple.quicktime.location.ISO6709", "")
    lat, lon = parse_iso6709(loc)

    # Size
    size = fmt.get("size", "")
    try:
        size_mb = round(int(size) / (1024 * 1024), 2) if size else ""
    except Exception:
        size_mb = ""

    # Bitrate (video stream preferred, else format)
    vbr = vs.get("bit_rate") or fmt.get("bit_rate", "")
    try:
        vbr_kbps = round(int(vbr) / 1000) if vbr else ""
    except Exception:
        vbr_kbps = ""

    return {
        "duration": dur,
        "fps": fps,
        "resolution": resolution,
        "orientation": orient,
        "codec": vs.get("codec_name", ""),
        "pix_fmt": vs.get("pix_fmt", ""),
        "color_space": vs.get("color_space", ""),
        "bitrate_kbps": vbr_kbps,
        "has_audio": "yes" if a0 else "no",
        "audio_codec": a0.get("codec_name", ""),
        "audio_channels": a0.get("channels", ""),
        "audio_sample_rate": a0.get("sample_rate", ""),
        "size_mb": size_mb,
        "creation_time": creation,
        "vfr": vfr,
        "rotation": rotation,
        "latitude": lat,
        "longitude": lon,
    }

def main():
    ap = argparse.ArgumentParser(
        description="Build video_analysis.csv metadata from a corpus of video files.")
    ap.add_argument("--root", type=str, default=ROOT,
                    help="root directory containing site video folders "
                         "(default: parent of script directory)")
    ap.add_argument("--output", type=str, default=None,
                    help="output CSV path (default: <root>/video_analysis.csv)")
    ap.add_argument("--folders", nargs="*", default=None,
                    help="site folder names to scan (default: built-in list)")
    args = ap.parse_args()

    root = args.root
    folders = args.folders if args.folders else FOLDERS
    out = args.output if args.output else os.path.join(root, "video_analysis.csv")

    rows = []
    for folder in folders:
        fpath = os.path.join(root, folder)
        site = sitename(folder)
        for dirpath, _, files in os.walk(fpath):
            for fn in files:
                ext = os.path.splitext(fn)[1].lower()
                if ext not in VIDEO_EXT:
                    continue
                full = os.path.join(dirpath, fn)
                m = probe(full)
                print(f"{folder}/{fn}: {m.get('codec')} {m.get('resolution')} {m.get('fps')}fps vfr={m.get('vfr')} rot={m.get('rotation')} audio={m.get('has_audio')} gps=({m.get('latitude')},{m.get('longitude')})")
                rows.append([
                    fn, folder,
                    m.get("duration", ""), m.get("fps", ""),
                    m.get("resolution", ""), m.get("orientation", ""),
                    site,
                    m.get("codec", ""), m.get("bitrate_kbps", ""),
                    m.get("pix_fmt", ""), m.get("color_space", ""),
                    m.get("has_audio", ""), m.get("audio_codec", ""),
                    m.get("audio_channels", ""), m.get("audio_sample_rate", ""),
                    m.get("size_mb", ""), m.get("creation_time", ""),
                    m.get("vfr", ""), m.get("rotation", ""),
                    m.get("latitude", ""), m.get("longitude", ""),
                ])

    with open(out, "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow([
            "Filename", "Foldername", "Duration(s)", "fps", "Resolution", "Orientation", "Sitename",
            "VideoCodec", "VideoBitrate(kbps)", "PixelFormat", "ColorSpace",
            "HasAudio", "AudioCodec", "AudioChannels", "AudioSampleRate(Hz)",
            "FileSize(MB)", "CreationTime", "VFR", "Rotation",
            "Latitude", "Longitude",
        ])
        wr.writerows(rows)
    print(f"\nWrote {len(rows)} rows -> {out}")


if __name__ == "__main__":
    main()
