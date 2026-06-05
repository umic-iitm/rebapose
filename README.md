# REBAPose

Automated REBA (Rapid Entire Body Assessment) ergonomic risk scoring from images and videos using 2D/3D human pose estimation.

REBAPose combines a custom-trained HRNet-based 18-keypoint pose estimation model with 3D pose lifting (MotionBERT) and the REBA ergonomic assessment framework to automatically detect workers in images and compute ergonomic risk scores for each detected person.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [REBA Score Interpretation](#reba-score-interpretation)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Usage](#usage)
  - [Basic Usage](#basic-usage)
  - [Single Image Processing](#single-image-processing)
  - [Batch Processing](#batch-processing)
  - [Video Processing](#video-processing)
  - [Processing a Raw Frame (NumPy Array)](#processing-a-raw-frame-numpy-array)
  - [Custom Model Paths](#custom-model-paths)
  - [Accessing Results Programmatically](#accessing-results-programmatically)
- [Constructor Parameters](#constructor-parameters)
- [API Reference](#api-reference)
- [Output Format](#output-format)
  - [Annotated Image](#annotated-image)
  - [JSON Output](#json-output)
- [Keypoint Definitions](#keypoint-definitions)
  - [2D Keypoints (18 points)](#2d-keypoints-18-points)
  - [3D Keypoints (17 points)](#3d-keypoints-17-points)
- [Model Architecture](#model-architecture)
- [Dependencies](#dependencies)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## Features

- **Multi-person detection**: Automatically detects all persons in an image using YOLOX-L object detector
- **Custom 18-keypoint 2D pose estimation**: Uses a custom-trained HRNet-W32 model with REBA-specific keypoints (including forehead, neck, center hip, and hand keypoints not present in standard COCO)
- **3D pose lifting**: Lifts 2D poses to 3D using MotionBERT for accurate angle computation
- **Bilateral REBA scoring**: Computes REBA scores independently for left and right body sides, taking the worst-case score
- **Color-coded skeleton visualization**: Draws skeletons on output images color-coded by risk level (green/yellow/orange/red)
- **Structured JSON output**: Exports detailed per-person results including individual joint angles, partial scores, and aggregate REBA scores
- **Image batch processing**: Process an entire directory of images in one call
- **Video processing**: Process video files with per-frame REBA scoring, annotated output video, and per-frame JSON export
- **Automatic video compression**: Converts raw MJPEG output to H.264 via ffmpeg, reducing file size by 10-50x
- **Frame-level API**: Process individual numpy arrays for custom pipelines (webcam, streaming, etc.)

---

## How It Works

```
Input Image
    |
    v
[YOLOX-L Detector] --> Person bounding boxes
    |
    v
[HRNet-W32 2D Pose] --> 18 keypoints per person (custom REBA keypoint set)
    |
    v
[MotionBERT 3D Lifter] --> 17 x 3D coordinates per person
    |
    v
[REBA Angle Computation] --> Joint angles (neck, trunk, legs, arms, wrists)
    |                         Computed for both left and right sides
    v
[REBA Score Tables] --> Score A (posture) + Score B (arms) --> Score C (final)
    |
    v
Annotated Image + JSON Report
```

---

## REBA Score Interpretation

| Score C | Risk Level | Action | Skeleton Color |
|---------|-----------|--------|----------------|
| 1 | Negligible | None necessary | Green |
| 2-3 | Low | May be necessary | Green |
| 4-7 | Medium | Necessary | Orange |
| 8-10 | High | Necessary soon | Red-Orange |
| 11+ | Very High | Immediate action | Red |

---

## Installation

### Prerequisites

- Python 3.8+
- CUDA-compatible GPU (recommended for real-time inference)
- PyTorch with CUDA support

### Step 1: Install dependencies

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118
pip install mmcv mmpose mmdet
pip install ergonomics
pip install opencv-python numpy tqdm

# For video compression (optional but recommended)
# Install ffmpeg: https://ffmpeg.org/download.html
# Ensure 'ffmpeg' is available on your system PATH
```

> **Note**: For detailed MMPose installation instructions, refer to the [MMPose installation guide](https://mmpose.readthedocs.io/en/latest/installation.html).

### Step 2: Download model files

You need the following two model files placed alongside `REBAPose.py` (or provide absolute paths):

| File | Description |
|------|-------------|
| `reba_keypoint.py` | MMPose config file defining the custom 18-keypoint HRNet-W32 model architecture and dataset info |
| `best-6359ffd3_20231208.pth` | Trained weights for the custom REBA keypoint model |

The detection model (YOLOX-L) and 3D pose lifter (MotionBERT) weights are **downloaded automatically** by MMPose on first run.

### Step 3: Copy files to your project

```
your_project/
├── REBAPose.py                    # Main class
├── reba_keypoint.py               # Pose2D model config
├── best-6359ffd3_20231208.pth     # Pose2D model weights
├── images/                        # Your input images
└── output/                        # Generated automatically
```

---

## Project Structure

```
REBAPose.py                 # Main class — the only file you import
reba_keypoint.py            # MMPose config: HRNet-W32 backbone, 18 REBA keypoints,
|                             dataset info, training/val pipelines, codec settings
best-6359ffd3_20231208.pth  # Trained model weights (checkpoint)
```

---

## Usage

### Basic Usage

```python
from REBAPose import REBAPose

reba = REBAPose(
    input_images_path='./images',
    output_path='./output'
)

# Process all images in the input directory
results = reba.process_all()
```

### Single Image Processing

```python
from REBAPose import REBAPose

reba = REBAPose(
    input_images_path='./images',
    output_path='./output'
)

result = reba.process_image('./images/worker_photo.jpg')

# Access the results
print(f"Annotated image saved to: {result['annotated_image']}")
print(f"JSON report saved to: {result['json_path']}")

for i, person in enumerate(result['persons']):
    score = person['reba']['aggregateScore']
    print(f"Person {i}: Score C = {score['ScoreC']} ({score['Caption']})")
```

### Batch Processing

```python
from REBAPose import REBAPose

reba = REBAPose(
    input_images_path='./site_photos',
    output_path='./reba_reports'
)

results = reba.process_all()

for img_name, result in results.items():
    scores = [p['reba']['aggregateScore']['ScoreC'] for p in result['persons']]
    print(f"{img_name}: REBA scores = {scores}")
```

### Video Processing

```python
from REBAPose import REBAPose

reba = REBAPose(
    input_images_path='./images',
    output_path='./output'
)

# Process a video (auto-compresses to H.264 via ffmpeg)
result = reba.process_video('./vid_input/site_video.mp4')
print(f"Output video: {result['video_path']}")
print(f"Frames processed: {len(result['frame_results'])}")

# Process every 5th frame only (5x faster)
result = reba.process_video('./vid_input/site_video.mp4', frame_skip=5)

# Skip compression (keep raw MJPEG — larger file, no ffmpeg needed)
result = reba.process_video('./vid_input/site_video.mp4', compress=False)
```

**Output files for a video named `site_video.mp4`:**
```
output/
├── site_video.mp4              # Annotated + compressed video
├── site_video_1.json           # REBA data for frame 1
├── site_video_2.json           # REBA data for frame 2
├── site_video_3.json           # ...
└── ...
```

### Processing a Raw Frame (NumPy Array)

Use `process_frame()` when you have frames in memory (webcam, custom video loop, streaming):

```python
import cv2
from REBAPose import REBAPose

reba = REBAPose(input_images_path='.', output_path='./output')

# From a webcam
cap = cv2.VideoCapture(0)
ret, frame = cap.read()
result = reba.process_frame(frame)

for person in result['persons']:
    print(f"REBA Score C: {person['reba']['aggregateScore']['ScoreC']}")

# The annotated frame is in result['annotated_frame'] (numpy array)
cv2.imshow('REBA', result['annotated_frame'])
cap.release()
```

### Custom Model Paths

```python
reba = REBAPose(
    input_images_path='./images',
    output_path='./output',
    pose2d='/absolute/path/to/reba_keypoint.py',
    pose2d_weights='/absolute/path/to/best-6359ffd3_20231208.pth'
)
```

### Accessing Results Programmatically

```python
result = reba.process_image('./images/input.jpg')

for person in result['persons']:
    reba_data = person['reba']

    # Individual joint scores
    neck_angle = reba_data['individualScore']['neck']['angleDegree']
    trunk_angle = reba_data['individualScore']['trunk']['angleDegree']

    # Upper arm angles (bilateral)
    left_upper_arm = reba_data['individualScore']['upperArm']['left']['angleDegree']
    right_upper_arm = reba_data['individualScore']['upperArm']['right']['angleDegree']

    # Aggregate scores
    score_a = reba_data['aggregateScore']['ScoreA']  # Posture score (neck + trunk + legs)
    score_b = reba_data['aggregateScore']['ScoreB']  # Arms score (upper arm + lower arm + wrist)
    score_c = reba_data['aggregateScore']['ScoreC']  # Final REBA score
    caption = reba_data['aggregateScore']['Caption']  # Risk level description

    # 2D keypoints (named dictionary)
    nose_2d = person['keypoints']['nose']           # [x, y]
    left_shoulder = person['keypoints']['left_shoulder']

    # 3D keypoints (named dictionary)
    neck_3d = person['keypoints_3d']['neck']        # [x, y, z]
```

---

## Constructor Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `input_images_path` | `str` | *required* | Path to directory containing input images |
| `output_path` | `str` | *required* | Path to directory where annotated images and JSON files will be saved (created automatically if it doesn't exist) |
| `pose2d` | `str` | `'reba_keypoint.py'` | Path to the MMPose 2D pose estimation config file |
| `pose2d_weights` | `str` | `'best-6359ffd3_20231208.pth'` | Path to the trained 2D pose estimation model weights |

---

## API Reference

### `REBAPose(input_images_path, output_path, pose2d, pose2d_weights)`

Initializes the pose estimation pipeline. Loads the detection model, 2D pose model, and 3D pose lifter. This may take a few seconds on first run as pre-trained detection and 3D lifting weights are downloaded.

### `process_frame(frame, frame_num=None) -> dict`

Core method. Processes a single numpy array (BGR image) and returns:

| Key | Type | Description |
|-----|------|-------------|
| `annotated_frame` | `np.ndarray` | The frame with skeleton overlay drawn on it |
| `persons` | `list[dict]` | List of per-person results (keypoints + REBA scores) |

If `frame_num` is provided, a frame counter label is drawn on the top-left corner.

### `process_image(image_path) -> dict`

Reads an image from disk, calls `process_frame()`, and saves outputs. Returns:

| Key | Type | Description |
|-----|------|-------------|
| `annotated_image` | `str` | File path to the saved annotated image with skeleton overlay |
| `json_path` | `str` | File path to the saved JSON report |
| `persons` | `list[dict]` | List of per-person results (keypoints + REBA scores) |

### `process_video(video_path, frame_skip=1, compress=True) -> dict`

Processes all frames of a video file. Writes an annotated output video and per-frame JSON files.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `video_path` | `str` | *required* | Path to input video file (`.mp4`, `.avi`, `.mov`) |
| `frame_skip` | `int` | `1` | Process every Nth frame. Set to `1` to process all frames. |
| `compress` | `bool` | `True` | Re-encode output video with H.264 via ffmpeg. Reduces file size by 10-50x. Falls back to uncompressed MJPEG if ffmpeg is not installed. |

**Returns:**

| Key | Type | Description |
|-----|------|-------------|
| `video_path` | `str` | File path to the output video (compressed if `compress=True`) |
| `frame_results` | `dict[int, list]` | Dictionary mapping frame numbers to their person results |

### `process_all() -> dict`

Processes all images (`.jpg`, `.jpeg`, `.png`, `.bmp`) in `input_images_path`. Returns a dictionary keyed by image filename, where each value is the same result dict as `process_image()`.

---

## Output Format

### Annotated Image

Each output image contains:
- **Person ID labels** displayed near the forehead keypoint in light green
- **Skeleton lines** connecting the 18 keypoints, color-coded by REBA risk level:
  - Green (Score C <= 3): Low risk
  - Orange (Score C 4-7): Medium risk
  - Red-Orange (Score C 8-10): High risk
  - Red (Score C 11+): Very high risk

### JSON Output

Each JSON file contains an array of person objects. Example for one person:

```json
[
  {
    "keypoints": {
      "forehead": [285.6, 172.2],
      "nose": [285.6, 220.8],
      "neck": [313.4, 311.0],
      "left_shoulder": [438.3, 324.9],
      "right_shoulder": [181.5, 338.8],
      "left_elbow": [591.0, 477.6],
      "right_elbow": [160.7, 533.1],
      "left_wrist": [528.5, 456.8],
      "right_wrist": [174.6, 644.2],
      "left_hip": [445.3, 630.3],
      "center_hip": [362.0, 637.2],
      "right_hip": [264.8, 665.0],
      "left_knee": [604.9, 699.7],
      "right_knee": [230.1, 588.6],
      "left_ankle": [410.5, 727.5],
      "right_ankle": [445.3, 727.5],
      "left_hand": [486.9, 422.1],
      "right_hand": [167.6, 387.4]
    },
    "reba": {
      "individualScore": {
        "trunk": { "angleDegree": 25, "sideBending": 0 },
        "neck": { "angleDegree": 15, "sideBending": 0 },
        "legs": { "walking": 0, "angleDegree": 30 },
        "upperArm": {
          "left": { "angleDegree": 45, "armRotated": 0, "shoulderRaised": 0, "leaning": 0 },
          "right": { "angleDegree": 50, "armRotated": 0, "shoulderRaised": 0, "leaning": 0 }
        },
        "lowerArm": {
          "left": { "angleDegree": 60 },
          "right": { "angleDegree": 70 }
        },
        "wrist": {
          "left": { "angleDegree": 10, "twisted": 0 },
          "right": { "angleDegree": 15, "twisted": 0 }
        }
      },
      "aggregateScore": {
        "ScoreA": 4,
        "ScoreB": 3,
        "ScoreC": 5,
        "Caption": "Medium risk, further investigation, change soon"
      }
    },
    "keypoints_3d": {
      "center_hip": [0.0, 0.0, 0.24],
      "right_hip": [0.19, 0.02, 0.18],
      "neck": [0.09, -0.08, 0.93],
      "...": "..."
    }
  }
]
```

---

## Keypoint Definitions

### 2D Keypoints (18 points)

Custom REBA-specific keypoint layout trained on annotated data:

| Index | Name | Body Region |
|-------|------|-------------|
| 0 | forehead | Head |
| 1 | nose | Head |
| 2 | neck | Head/Torso |
| 3 | left_shoulder | Upper body |
| 4 | right_shoulder | Upper body |
| 5 | left_elbow | Upper body |
| 6 | right_elbow | Upper body |
| 7 | left_wrist | Upper body |
| 8 | right_wrist | Upper body |
| 9 | left_hip | Lower body |
| 10 | center_hip | Lower body |
| 11 | right_hip | Lower body |
| 12 | left_knee | Lower body |
| 13 | right_knee | Lower body |
| 14 | left_ankle | Lower body |
| 15 | right_ankle | Lower body |
| 16 | left_hand | Upper body |
| 17 | right_hand | Upper body |

### 3D Keypoints (17 points)

Produced by the MotionBERT 3D pose lifter:

| Index | Name |
|-------|------|
| 0 | center_hip |
| 1 | right_hip |
| 2 | right_knee |
| 3 | right_ankle |
| 4 | left_hip |
| 5 | left_knee |
| 6 | left_ankle |
| 7 | torso |
| 8 | neck |
| 9 | nose |
| 10 | head |
| 11 | left_shoulder |
| 12 | left_elbow |
| 13 | left_wrist |
| 14 | right_shoulder |
| 15 | right_elbow |
| 16 | right_wrist |

---

## Model Architecture

| Component | Model | Details |
|-----------|-------|---------|
| **Person Detector** | YOLOX-L | Pre-trained on COCO, detects person class only. Downloaded automatically. |
| **2D Pose Estimator** | HRNet-W32 | Custom-trained on 18 REBA keypoints. Top-down approach with MSRA heatmap codec (192x256 input, 48x64 heatmap). Uses EMA and two-stage training with augmentation. |
| **3D Pose Lifter** | MotionBERT | Pre-trained on Human3.6M dataset. Lifts 2D keypoints to 3D coordinates. Downloaded automatically. |
| **REBA Scoring** | [ergonomics](https://github.com/rs9000/ergonomics) | Computes joint angles and REBA scores from 3D pose. Bilateral assessment (left/right), worst-case aggregation. |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `torch` | Deep learning framework |
| `mmpose` | 2D/3D pose estimation inference |
| `mmdet` | Person detection (YOLOX) |
| `mmcv` | OpenMMLab foundation |
| `ergonomics` | REBA score computation ([GitHub](https://github.com/rs9000/ergonomics)) |
| `opencv-python` | Image I/O and annotation |
| `numpy` | Array operations |
| `tqdm` | Progress bars for batch/video processing |
| `ffmpeg` (system) | Video compression to H.264 (optional, used by `process_video`) |

---

## Acknowledgements

- [MMPose](https://github.com/open-mmlab/mmpose) for the pose estimation framework
- [ergonomics](https://github.com/rs9000/ergonomics) for the REBA scoring implementation
- [MotionBERT](https://github.com/Walter0807/MotionBERT) for 3D pose lifting

---

## License

Please refer to the individual licenses of the dependencies (MMPose, MMDetection, ergonomics, MotionBERT) for usage terms.
