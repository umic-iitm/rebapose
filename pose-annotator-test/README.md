# Pose Annotator Test

Test and staging environment for the [Pose Angle Annotator](../pose-angle-annotator/). This instance runs the same annotation workflow against a separate set of GCS buckets and Firestore collections, allowing validation of changes before deploying to the production annotator.

---

## Relationship to Pose Angle Annotator

This project shares the same codebase architecture (React + Node/Express + GCS + Firestore) and nearly identical code as `pose-angle-annotator`. The key differences are:

- Points to **test** GCS buckets and Firestore collections (configured via `.env`)
- Used for **validating annotation UI changes** and **testing data pipeline integrations** before rolling out to crowd annotators
- Runs independently so test data never mixes with production annotations

For full documentation of the annotation workflow, features, keyboard shortcuts, and annotation format, see the [Pose Angle Annotator README](../pose-angle-annotator/README.md).

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
- Service account credentials (JSON key file)
- Docker (optional)

---

## Setup & Run

### Environment Variables

Create a `.env` file in the server directory. Point these to your **test** buckets (not production):

```
POSE_DATASET_IMAGE=<GCS test bucket for images>
POSE_DATASET_INPUT=<GCS test bucket for input pose JSONs>
POSE_DATASET_OUTPUT=<GCS test bucket for annotated output JSONs>
GOOGLE_APPLICATION_CREDENTIALS=<path to service account key>
```

### Development

**Frontend** (port 3000):
```bash
cd pose-annotation-crowdsourcer-client
npm install
npm start
```

**Backend** (port 8080):
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

Serves the React build from Express on port 80.

---

## Project Structure

```
pose-annotator-test/
├── pose-annotation-crowdsourcer-client/    # React frontend
│   ├── src/
│   │   ├── App.js                          # Main logic & state management
│   │   ├── components/                     # Canvas, PartsListRow, SkipDialog, ViewAnnotation
│   │   └── config/
│   │       ├── points.json                 # 18 keypoint definitions
│   │       └── mandatory_points.json       # 3 required keypoints
│   └── package.json
│
└── pose-annotation-crowdsourcer-server-src/ # Node.js backend
    ├── app.js                               # Express routes
    ├── db/firestore.js                      # Firestore client
    ├── storage/storage.js                   # GCS operations
    ├── Dockerfile
    └── docker-compose.yml
```
