# REBA SME Verify

A web-based tool for Subject Matter Expert (SME) verification of AI-predicted body keypoints. Experts compare keypoint predictions from three pose estimation models and vote on which prediction is most accurate for each body part.

---

## What It Does

For each image, the tool displays two colored circles (randomly assigned to avoid bias) representing predictions from different models. The expert selects which circle is closer to the correct body part location. This is repeated for three critical keypoints -- **forehead**, **neck**, and **center hip** -- before moving to the next image.

The three models being compared:
- **REBA** (custom HRNet-based model)
- **YOLO** (YOLOv8 pose)
- **Detectron2** (Meta's pose estimator)

Aggregated votes determine which model performs best per body part, informing model selection and training decisions.

![SME Verification UI](ui%20format.jpeg)

*The 3-column interface: skeleton reference and instructions (left), worker image with two colored keypoint predictions (center), and the voting form (right).*

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3, Flask |
| Frontend | HTML5, JavaScript, Konva.js (canvas) |
| Styling | Bootstrap 5.3 |
| Data Processing | Pandas (results aggregation) |
| Data Format | JSON (input predictions + output votes) |

---

## Prerequisites

- Python 3.8+
- pip

---

## Setup & Run

### Install Dependencies

```bash
pip install flask pandas
```

### Run the Application

```bash
cd reba-sme-verify
python main.py
```

The app starts on **port 80** (requires admin/root privileges). To use a different port, edit the last line in `main.py`:

```python
app.run(debug=True, host='0.0.0.0', port=5000)
```

### Access

- **Annotation interface**: `http://localhost/`
- **Results dashboard**: `http://localhost/table-results`

---

## Project Structure

```
reba-sme-verify/
├── main.py                     # Flask app with all routes
├── question.json               # Template for annotation data structure
├── templates/
│   ├── index.html              # Main annotation interface (3-column layout)
│   └── table.html              # Results dashboard with aggregated scores
├── static/
│   ├── index.js                # Frontend logic: canvas, voting, form submission
│   ├── styles.css              # Custom styles
│   ├── images/                 # 74 JPG images for annotation
│   ├── jsons/                  # 88 JSON files with multi-model predictions
│   ├── output/                 # Saved vote results (generated at runtime)
│   └── pose.jpeg, pose2.jpeg   # Reference images for the UI
└── .gitignore
```

---

## How It Works

1. **Load image**: Flask serves the next JSON from `static/jsons/`, which contains the image reference, bounding box, and predicted keypoint coordinates from all three models
2. **Annotate 3 body parts**: For each of forehead, neck, and center hip, two colored circles appear on the canvas. The expert picks the more accurate one
3. **Color randomization**: Which model gets which color is randomized per image to prevent positional bias
4. **Save votes**: After 3 votes (one full image), results POST to `/add_score_person` and are saved to `static/output/`
5. **View results**: `/table-results` aggregates all output files into a Pandas DataFrame showing vote counts per model per body part

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Renders the annotation interface |
| GET | `/get_next_json` | Returns the next JSON file with image and model predictions |
| POST | `/add_score_person` | Saves vote results for one image |
| GET | `/table-results` | Renders aggregated results table |
| POST | `/reset-index` | Resets the JSON counter to restart from the first image |
| DELETE | `/delete_output_files` | Clears all saved votes and resets the index |

---

## Input Data Format

Each JSON file in `static/jsons/` contains:

```json
{
  "id": "17075431689554_1",
  "image_name": "17075431689554.jpg",
  "bbox": [x1, y1, x2, y2],
  "forehead": {
    "reba": [x, y],
    "detectron": [x, y],
    "yolo": [x, y]
  },
  "neck": { "reba": [...], "detectron": [...], "yolo": [...] },
  "center_hip": { "reba": [...], "detectron": [...], "yolo": [...] },
  "score": {
    "forehead": { "reba": 0, "detectron": 0, "yolo": 0 },
    "neck": { "reba": 0, "detectron": 0, "yolo": 0 },
    "center_hip": { "reba": 0, "detectron": 0, "yolo": 0 },
    "annotations": 0
  }
}
```

---

## Key Features

- **Interactive canvas**: Zoom and pan with mouse wheel for detailed keypoint examination
- **Bias-free comparison**: Color-to-model assignment is randomized per image
- **Real-time aggregation**: Results table auto-sums votes across all annotators
- **Data management**: Reset and delete buttons allow restarting the verification process
