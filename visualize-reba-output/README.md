# REBA Visualizer

A React application for browsing images alongside their REBA (Rapid Entire Body Assessment) scoring results. Navigate through annotated images and inspect detailed ergonomic risk scores in tabular format.

---

## What It Does

The viewer loads a set of images and their corresponding REBA JSON result files. For each image, it displays:

- The original image (construction site worker posture)
- A table of **REBA aggregate scores**: Table A (posture), Table B (arms), Score A, Score B, Score C (final), and risk caption
- **Individual joint scores**: trunk angle, neck angle, leg position, upper/lower arm angles, wrist angles, and modifier factors (load, coupling, activity)

Users navigate between images with Previous/Next buttons. When an image has multiple REBA analyses (e.g., multiple detected persons), all are shown.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| UI | Bootstrap 5.3 |
| Data Formatting | js-yaml (for readable object display) |
| Build Tool | Create React App |

---

## Prerequisites

- Node.js 14+
- npm

---

## Setup & Run

```bash
cd visualize-reba-ouput
npm install
npm start
```

Opens at `http://localhost:3000` with live reloading.

### Production Build

```bash
npm run build
```

Creates an optimized bundle in `build/`.

---

## Project Structure

```
visualize-reba-ouput/
├── public/
│   └── index.html              # HTML entry point
├── src/
│   ├── App.js                  # Main component: image navigation + REBA table rendering
│   ├── App.css                 # Component styling
│   ├── index.js                # React entry point
│   ├── images/                 # 74 JPG images (construction site postures)
│   └── jsons/                  # 92 JSON files (REBA analysis results)
└── package.json
```

---

## Data Format

Each JSON file in `src/jsons/` contains per-person REBA results:

```json
{
  "image_id": "17075431689554",
  "file_name": "17075431689554.jpg",
  "bbox": [x1, y1, x2, y2],
  "keypoints": { "forehead": [x, y], "neck": [x, y], "..." : "..." },
  "aggregateScore": {
    "tableA": 4, "tableBL": 3, "tableBR": 3,
    "ScoreA": 4, "ScoreB": 3, "ScoreC": 5,
    "finalReba": "Medium risk, further investigation, change soon"
  },
  "individualScore": {
    "trunk": { "angleDegree": 25, "sideBending": 0 },
    "neck": { "angleDegree": 15, "sideBending": 0 },
    "legs": { "walking": 0, "angleDegree": 30 },
    "upperArm": { "left": { "angleDegree": 45 }, "right": { "angleDegree": 50 } },
    "lowerArm": { "left": { "angleDegree": 60 }, "right": { "angleDegree": 70 } },
    "wrist": { "left": { "angleDegree": 10 }, "right": { "angleDegree": 15 } }
  }
}
```

---

## Key Features

- **Image-by-image navigation**: Previous/Next buttons cycle through all 74 images
- **Multi-person support**: Images with multiple detected persons show all their REBA tables
- **Detailed scoring tables**: Both aggregate (Score A/B/C) and individual joint-level scores
- **ID-based pairing**: Images and JSONs are linked by timestamp-based naming convention
