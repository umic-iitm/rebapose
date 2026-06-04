import os
import json
import subprocess
import shutil
import numpy as np
import cv2
import tqdm
from mmpose.apis import MMPoseInferencer
from ergonomics.reba import RebaScore


class REBAPose:

    POINTS = {
        'forehead': 0, 'nose': 1, 'neck': 2, 'left_shoulder': 3,
        'right_shoulder': 4, 'left_elbow': 5, 'right_elbow': 6,
        'left_wrist': 7, 'right_wrist': 8, 'left_hip': 9,
        'center_hip': 10, 'right_hip': 11, 'left_knee': 12,
        'right_knee': 13, 'left_ankle': 14, 'right_ankle': 15,
        'left_hand': 16, 'right_hand': 17
    }

    POINTS_3D = {
        'center_hip': 0, 'right_hip': 1, 'right_knee': 2, 'right_ankle': 3,
        'left_hip': 4, 'left_knee': 5, 'left_ankle': 6, 'torso': 7,
        'neck': 8, 'nose': 9, 'head': 10, 'left_shoulder': 11,
        'left_elbow': 12, 'left_wrist': 13, 'right_shoulder': 14,
        'right_elbow': 15, 'right_wrist': 16
    }

    SKELETONS = [
        ('forehead', 'nose'), ('nose', 'neck'), ('neck', 'left_shoulder'),
        ('neck', 'right_shoulder'), ('left_shoulder', 'left_elbow'),
        ('right_shoulder', 'right_elbow'), ('left_elbow', 'left_wrist'),
        ('right_elbow', 'right_wrist'), ('neck', 'center_hip'),
        ('left_hip', 'center_hip'), ('center_hip', 'right_hip'),
        ('left_hip', 'left_knee'), ('right_hip', 'right_knee'),
        ('left_knee', 'left_ankle'), ('right_knee', 'right_ankle'),
        ('left_wrist', 'left_hand'), ('right_wrist', 'right_hand')
    ]

    SKELETON_COLORS = {
        'low': (0, 255, 0),
        'medium': (0, 170, 255),
        'high': (0, 50, 255),
        'very_high': (0, 0, 255),
    }

    _MODULE_DIR = os.path.dirname(os.path.abspath(__file__))

    def __init__(self, input_images_path, output_path,
                 pose2d='reba_keypoint.py',
                 pose2d_weights='best-6359ffd3_20231208.pth',
                 annotation=True):
        self.input_images_path = input_images_path
        self.output_path = output_path
        self.annotation = annotation

        if not os.path.isabs(pose2d):
            pose2d = os.path.join(self._MODULE_DIR, pose2d)
        if not os.path.isabs(pose2d_weights):
            pose2d_weights = os.path.join(self._MODULE_DIR, pose2d_weights)
        self.pose2d = pose2d
        self.pose2d_weights = pose2d_weights

        os.makedirs(self.output_path, exist_ok=True)

        self.reba_score = RebaScore()
        self.inferencer = MMPoseInferencer(
            det_model='yolox_l_8x8_300e_coco',
            det_cat_ids=[0],
            pose2d=self.pose2d,
            pose2d_weights=self.pose2d_weights,
            pose3d='human3d'
        )

    def _calculate_reba_3d_points(self, out_tensor):
        body_params_r = self.reba_score.get_body_angles_from_pose_right(out_tensor)
        arms_params_r = self.reba_score.get_arms_angles_from_pose_right(out_tensor)
        body_params_l = self.reba_score.get_body_angles_from_pose_left(out_tensor)
        arms_params_l = self.reba_score.get_arms_angles_from_pose_left(out_tensor)

        self.reba_score.set_body(body_params_r)
        score_a_r, partial_a_r = self.reba_score.compute_score_a()

        self.reba_score.set_body(body_params_l)
        score_a_l, partial_a_l = self.reba_score.compute_score_a()

        if score_a_r > score_a_l:
            score_a = score_a_r
            body_params = body_params_r
        else:
            score_a = score_a_l
            body_params = body_params_l

        self.reba_score.set_arms(arms_params_r)
        score_b_r, partial_b_r = self.reba_score.compute_score_b()

        self.reba_score.set_arms(arms_params_l)
        score_b_l, partial_b_l = self.reba_score.compute_score_b()

        if score_b_r > score_b_l:
            score_b = score_b_r
            arms_params = arms_params_r
        else:
            score_b = score_b_l
            arms_params = arms_params_l

        score_c, caption = self.reba_score.compute_score_c(score_a, score_b)

        reba_data = {
            "individualScore": {
                "trunk": {
                    "angleDegree": int(body_params_r[2]),
                    "sideBending": int(body_params_r[3])
                },
                "neck": {
                    "angleDegree": int(body_params_r[0]),
                    "sideBending": int(body_params_r[1])
                },
                "legs": {
                    "walking": int(body_params_r[4]),
                    "angleDegree": int(body_params_r[5])
                },
                "upperArm": {
                    "left": {
                        "angleDegree": int(arms_params_l[0]),
                        "armRotated": int(arms_params_l[2]),
                        "shoulderRaised": int(arms_params_l[1]),
                        "leaning": int(arms_params_l[3])
                    },
                    "right": {
                        "angleDegree": int(arms_params_r[0]),
                        "armRotated": int(arms_params_r[2]),
                        "shoulderRaised": int(arms_params_r[1]),
                        "leaning": int(arms_params_r[3])
                    }
                },
                "lowerArm": {
                    "left": {"angleDegree": int(arms_params_l[4])},
                    "right": {"angleDegree": int(arms_params_r[4])}
                },
                "wrist": {
                    "left": {
                        "angleDegree": int(arms_params_l[5]),
                        "twisted": int(arms_params_l[6])
                    },
                    "right": {
                        "angleDegree": int(arms_params_r[5]),
                        "twisted": int(arms_params_r[6])
                    }
                }
            },
            "aggregateScore": {
                "ScoreA": int(score_a),
                "ScoreB": int(score_b),
                "ScoreC": int(score_c),
                "Caption": caption
            }
        }
        return reba_data

    @staticmethod
    def _keypoint_list_dict(lst_pred, points, key_name='keypoints'):
        for inx in range(len(lst_pred)):
            keypoints_list = lst_pred[inx][key_name]
            keypoints_dict = {}
            for key, val in points.items():
                keypoints_dict[key] = keypoints_list[val]
            lst_pred[inx][key_name] = keypoints_dict
        return lst_pred

    def _get_skeleton_color(self, score_c):
        if score_c <= 3:
            return self.SKELETON_COLORS['low']
        elif score_c <= 7:
            return self.SKELETON_COLORS['medium']
        elif score_c <= 10:
            return self.SKELETON_COLORS['high']
        return self.SKELETON_COLORS['very_high']

    def _convert_3d_keypoints(self, keypoints):
        out_tensor_temp = np.zeros((14, 3), dtype=float)
        out_tensor_temp[[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]] = \
            keypoints[[10, 9, 11, 12, 13, 14, 15, 16, 4, 5, 6, 1, 2, 3]]
        out_tensor = out_tensor_temp.copy()
        out_tensor[:, [0, 1, 2]] = out_tensor[:, [1, 2, 0]]
        out_tensor[:, 1] = out_tensor[:, 1] - out_tensor[8][1]
        return out_tensor

    def _draw_skeleton(self, frame, keypoints_2d, skeleton_color):
        for p1, p2 in self.SKELETONS:
            x1, y1 = keypoints_2d[self.POINTS[p1]]
            x2, y2 = keypoints_2d[self.POINTS[p2]]
            cv2.line(frame, (int(x1), int(y1)), (int(x2), int(y2)), skeleton_color, 2)
        return frame

    def _annotate_frame(self, frame, keypoints_2d, person_num, skeleton_color):
        font = cv2.FONT_HERSHEY_SIMPLEX
        text_location = (
            max(10, int(keypoints_2d[0][0]) - 10),
            max(10, int(keypoints_2d[0][1]) - 10)
        )
        cv2.putText(frame, str(person_num), text_location, font, 0.9, (127, 233, 100), 2)
        self._draw_skeleton(frame, keypoints_2d, skeleton_color)
        return frame

    def _draw_score_summary(self, frame, person_scores):
        if not person_scores:
            return frame
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.7
        thickness = 2
        padding = 8
        bar_height = 30

        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (frame.shape[1], bar_height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

        x_offset = 10
        for person_num, score_c in person_scores:
            label = f"P{person_num}: {score_c}"
            color = self._get_skeleton_color(score_c)
            cv2.putText(frame, label, (x_offset, bar_height - padding), font, font_scale, color, thickness)
            text_width = cv2.getTextSize(label, font, font_scale, thickness)[0][0]
            x_offset += text_width + 15

            if person_num != person_scores[-1][0]:
                cv2.putText(frame, "|", (x_offset - 10, bar_height - padding), font, font_scale, (200, 200, 200), 1)

        return frame

    def process_frame(self, frame, frame_num=None):
        resp = self.inferencer(inputs=frame)
        person_json_list = []
        person_scores = []

        for idx, person in enumerate(resp):
            if person[0] == []:
                continue

            predictions = person[0]['predictions'][0]
            pose_data = person[1]

            for person_num in range(len(predictions)):
                keypoints = np.array(predictions[person_num]['keypoints'])
                out_tensor = self._convert_3d_keypoints(keypoints)
                reba_obj = self._calculate_reba_3d_points(out_tensor)

                keypoints_2d = pose_data.pred_instances.keypoints[person_num]

                person_json = {
                    'keypoints': keypoints_2d.tolist(),
                    'reba': reba_obj,
                    'keypoints_3d': keypoints.tolist()
                }
                person_json_list.append(person_json)

                score_c = reba_obj['aggregateScore']['ScoreC']
                skeleton_color = self._get_skeleton_color(score_c)
                frame = self._annotate_frame(frame, keypoints_2d, person_num, skeleton_color)
                person_scores.append((person_num, score_c))

        if self.annotation:
            self._draw_score_summary(frame, person_scores)

        if frame_num is not None:
            font = cv2.FONT_HERSHEY_SIMPLEX
            y_offset = 55 if self.annotation else 25
            cv2.putText(frame, f"frame {frame_num}", (5, y_offset), font, 0.9, (127, 233, 100), 2)

        person_json_list = self._keypoint_list_dict(person_json_list, self.POINTS)
        person_json_list = self._keypoint_list_dict(person_json_list, self.POINTS_3D, key_name='keypoints_3d')

        return {
            'annotated_frame': frame,
            'persons': person_json_list
        }

    def process_image(self, image_path):
        frame = cv2.imread(image_path)
        result = self.process_frame(frame)

        img_name = os.path.basename(image_path)
        base_name = os.path.splitext(img_name)[0]
        annotated_path = os.path.join(self.output_path, img_name)
        json_path = os.path.join(self.output_path, f'{base_name}.json')

        cv2.imwrite(annotated_path, result['annotated_frame'])
        with open(json_path, 'w') as f:
            json.dump(result['persons'], f)

        return {
            'annotated_image': annotated_path,
            'json_path': json_path,
            'persons': result['persons']
        }

    @staticmethod
    def _compress_video(input_path, output_path):
        if shutil.which('ffmpeg') is None:
            print("Warning: ffmpeg not found, skipping compression. Output is uncompressed MJPEG.")
            return input_path

        subprocess.run([
            'ffmpeg', '-y', '-i', input_path,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            output_path
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.remove(input_path)
        return output_path

    def process_video(self, video_path, frame_skip=1, compress=True):
        cap = cv2.VideoCapture(video_path)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        video_name = os.path.basename(video_path)
        base_name = os.path.splitext(video_name)[0]

        temp_video_path = os.path.join(self.output_path, f'{base_name}_temp.avi')
        final_video_path = os.path.join(self.output_path, video_name)

        out = cv2.VideoWriter(
            temp_video_path,
            cv2.VideoWriter_fourcc('M', 'J', 'P', 'G'),
            fps,
            (frame_width, frame_height)
        )

        all_frame_results = {}
        frame_num = 0

        with tqdm.tqdm(total=frame_count, desc=video_name) as pbar:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_num += 1
                pbar.update(1)

                if frame_num % frame_skip != 0:
                    continue

                result = self.process_frame(frame, frame_num=frame_num)

                json_path = os.path.join(self.output_path, f'{base_name}_{frame_num}.json')
                with open(json_path, 'w') as f:
                    json.dump(result['persons'], f)

                out.write(result['annotated_frame'])
                all_frame_results[frame_num] = result['persons']

        cap.release()
        out.release()

        if compress:
            final_video_path = self._compress_video(temp_video_path, final_video_path)
        else:
            shutil.move(temp_video_path, final_video_path)

        return {
            'video_path': final_video_path,
            'frame_results': all_frame_results
        }

    def process_all(self):
        images = [f for f in os.listdir(self.input_images_path)
                  if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))]
        results = {}
        for img in images:
            img_path = os.path.join(self.input_images_path, img)
            results[img] = self.process_image(img_path)
        return results


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='REBAPose - Automated REBA ergonomic risk scoring from images and videos',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Process all images in a folder:
    python REBAPose.py --input ./images --output ./output

  Process a single image:
    python REBAPose.py --image ./photo.jpg --output ./output

  Process a video:
    python REBAPose.py --video ./site_video.mp4 --output ./output

  Process a video, every 5th frame, no compression:
    python REBAPose.py --video ./site_video.mp4 --output ./output --frame-skip 5 --no-compress

  Custom model paths:
    python REBAPose.py --input ./images --output ./output --pose2d /path/to/config.py --pose2d-weights /path/to/weights.pth
        """
    )

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--input', type=str, help='Directory of input images (batch mode)')
    mode.add_argument('--image', type=str, help='Path to a single image')
    mode.add_argument('--video', type=str, help='Path to a video file')

    parser.add_argument('--output', type=str, required=True, help='Output directory for results')
    parser.add_argument('--pose2d', type=str, default='reba_keypoint.py', help='Path to pose2d config (default: reba_keypoint.py)')
    parser.add_argument('--pose2d-weights', type=str, default='best-6359ffd3_20231208.pth', help='Path to pose2d weights (default: best-6359ffd3_20231208.pth)')
    parser.add_argument('--frame-skip', type=int, default=1, help='Process every Nth frame for video (default: 1)')
    parser.add_argument('--no-compress', action='store_true', help='Skip ffmpeg compression for video output')
    parser.add_argument('--no-annotation', action='store_true', help='Disable score summary bar on output images/video')

    args = parser.parse_args()

    reba = REBAPose(
        input_images_path=args.input or os.path.dirname(args.image or args.video),
        output_path=args.output,
        pose2d=args.pose2d,
        pose2d_weights=args.pose2d_weights,
        annotation=not args.no_annotation
    )

    if args.video:
        result = reba.process_video(args.video, frame_skip=args.frame_skip, compress=not args.no_compress)
        print(f'Video processed: {result["video_path"]}')
        print(f'Frames analyzed: {len(result["frame_results"])}')
    elif args.image:
        result = reba.process_image(args.image)
        print(f'Annotated image: {result["annotated_image"]}')
        print(f'JSON report: {result["json_path"]}')
        for i, person in enumerate(result['persons']):
            score = person['reba']['aggregateScore']
            print(f'  Person {i}: Score C = {score["ScoreC"]} ({score["Caption"]})')
    else:
        results = reba.process_all()
        for img_name, result in results.items():
            scores = [p['reba']['aggregateScore']['ScoreC'] for p in result['persons']]
            print(f'{img_name}: ScoreC = {scores}')
