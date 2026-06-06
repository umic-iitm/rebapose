# Pose Angle Annotator

A crowdsourced web application for manually annotating human body keypoints on images. Annotators mark 18 joint positions per person through an interactive canvas, producing labeled pose data for training the REBAPose model.

---

## What It Does

Workers load images one at a time and click to place keypoints (forehead, nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles) on each person. Three points are mandatory before saving: **forehead**, **neck**, and **center hip** -- the minimum set needed for REBA trunk assessment. Completed annotations are stored as JSON files in Google Cloud Storage, with Firestore tracking annotation counts and access timestamps.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Konva.js (canvas), Bootstrap 5, SCSS |
| Backend | Node.js, Express 4 |
| Database | Google Cloud Firestore |
| Storage | Google Cloud Storage (signed URLs) |
| Deployment | Docker, Docker Compose |

---

## Prerequisites

- Node.js 18+
- A Google Cloud project with Firestore and Cloud Storage enabled
- Service account credentials (JSON key file) with access to the above
- Docker (optional, for containerized deployment)

---

## Setup & Run

### Environment Variables

Create a `.env` file in the server directory:

```
POSE_DATASET_IMAGE=<GCS bucket for images>
POSE_DATASET_INPUT=<GCS bucket for input pose JSONs>
POSE_DATASET_OUTPUT=<GCS bucket for annotated output JSONs>
GOOGLE_APPLICATION_CREDENTIALS=<path to service account key>
```

### Development

**Frontend** (runs on port 3000):
```bash
cd pose-annotation-crowdsourcer-client
npm install
npm start
```

**Backend** (runs on port 8080):
```bash
cd pose-annotation-crowdsourcer-server-src
npm install
npm run dev
```

### Production (Docker)

```bash
cd pose-annotation-crowdsourcer-server-src
docker-compose up --build
```

This serves the React build from the Express server on port 80.

---

## Project Structure

```
pose-angle-annotator/
├── pose-annotation-crowdsourcer-client/    # React frontend
│   ├── src/
│   │   ├── App.js                          # Main logic, state, keyboard shortcuts
│   │   ├── components/
│   │   │   ├── Canvas/                     # Konva canvas for placing keypoints
│   │   │   ├── PartsListRow/               # Body part list with coordinates
│   │   │   ├── SkipDailog/                 # Skip image confirmation
│   │   │   └── ViewAnnotation/             # Search & view existing annotations
│   │   └── config/
│   │       ├── points.json                 # 18 keypoint definitions
│   │       └── mandatory_points.json       # 3 required keypoints
│   └── package.json
│
└── pose-annotation-crowdsourcer-server-src/ # Node.js backend
    ├── app.js                               # Express routes & static serving
    ├── db/firestore.js                      # Firestore operations
    ├── storage/storage.js                   # GCS signed URL generation & upload
    ├── Dockerfile
    └── docker-compose.yml
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/image/new` | Fetch next unannotated image (supports `?startAfter` for pagination) |
| POST | `/api/image/save` | Save annotation JSON to GCS output bucket |
| GET | `/api/image/:image_id` | Retrieve records by image ID |
| GET | `/api/image/json/:json_name` | Retrieve image + annotation by JSON filename |

---

## Key Features

- **18 keypoints** with 3 mandatory (forehead, neck, center hip) enforced before save
- **Keyboard shortcuts**: `1`/`F` = forehead, `2`/`N` = neck, `3`/`H` = center hip, `Q` = obscure, `Shift+Space` = save
- **Auto-jump**: Automatically selects the next unannotated mandatory point
- **Zoom & pan**: Scroll to zoom, drag to pan the canvas
- **Color picker**: Assign custom colors to each keypoint for visibility
- **Crowd-sourcing**: Each annotation gets a unique nanoid, supporting multiple annotations per image
- **Resume support**: `localStorage` tracks the last annotated image so annotators can resume where they left off

---

## Annotation Format

Each saved JSON contains:

```json
{
  "image_id": "...",
  "json_name": "...",
  "key_points": {
    "forehead": [x, y, 2],
    "nose": [x, y, 2],
    "neck": [x, y, 2],
    "...": "..."
  }
}
```

Each keypoint is `[x_coordinate, y_coordinate, confidence]` where confidence `2` = annotated, `0` = obscured/not visible.
