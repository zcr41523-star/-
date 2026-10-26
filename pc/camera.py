"""Windows USB 摄像头入口：python -m pc.camera --camera 0。"""
import argparse
import copy
import os
import sys
import time
from pathlib import Path
from uuid import uuid4

import cv2
import httpx
import mediapipe as mp

from backend.gate import CONFIG, GestureGate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--camera', type=int, default=0)
    parser.add_argument('--threshold', type=float, default=CONFIG['threshold'])
    parser.add_argument('--url', default='http://127.0.0.1:8000')
    parser.add_argument('--model', default=str(Path(__file__).resolve().parents[1]/'docs/models/gesture_recognizer.task'))
    parser.add_argument('--probe', action='store_true', help='只检查摄像头能否打开并读取，不运行 AI')
    args = parser.parse_args()
    if not 0 <= args.threshold <= 1:
        parser.error('threshold 必须在 0..1')
    config = copy.deepcopy(CONFIG)
    config['threshold'] = args.threshold
    gate = GestureGate(config)
    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW if sys.platform == 'win32' else cv2.CAP_ANY)
    try:
        if not cap.isOpened():
            raise RuntimeError(f'摄像头 {args.camera} 无法打开；检查 Windows 摄像头权限、USB 连接、占用情况，或尝试 --camera 1')
        ok, frame = cap.read()
        if not ok or frame is None:
            raise RuntimeError('摄像头已打开但无法读取画面')
        if args.probe:
            print(f'摄像头可用：{frame.shape[1]}x{frame.shape[0]}；未测试真实手部识别')
            return 0
        token = os.getenv('CARE_TOKEN', '')
        if len(token) < 16:
            raise RuntimeError('请设置至少 16 字符的 CARE_TOKEN')
        with httpx.Client(base_url=args.url, headers={'Authorization': 'Bearer '+token}, timeout=5) as client:
            health = client.get('/api/health')
            health.raise_for_status()
            if health.json()['input_mode'] != 'pc':
                raise RuntimeError('后端 CARE_INPUT_MODE 不是 pc；请停止浏览器入口并重启后端')
            client.get('/api/state').raise_for_status()
            options = mp.tasks.vision.GestureRecognizerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=args.model),
                running_mode=mp.tasks.vision.RunningMode.VIDEO, num_hands=1)
            with mp.tasks.vision.GestureRecognizer.create_from_options(options) as recognizer:
                last_ts = -1
                while True:
                    capture_started = time.monotonic()
                    ok, frame = cap.read()
                    if not ok or frame is None:
                        gate.reset()
                        raise RuntimeError('摄像头断流，计时已重置，入口停止')
                    if time.monotonic()-capture_started > config['maxGapMs']/1000:
                        gate.reset()
                    now = max(last_ts+1, int(time.monotonic()*1000))
                    last_ts = now
                    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    result = recognizer.recognize_for_video(image, now)
                    cat = result.gestures[0][0] if result.gestures else None
                    name, score = (cat.category_name, cat.score) if cat else ('', 0)
                    action = gate.update(name, score, now)
                    if action:
                        event = dict(id=str(uuid4()), action=action, source='pc')
                        try:
                            response = client.post('/api/events', json=event)
                            response.raise_for_status()
                            print('后端确认', event, response.json())
                        except httpx.HTTPError as exc:
                            # Keep the UUID in the log for explicit diagnosis; never queue stale actions.
                            print('发送失败，结果未知；先读取状态，不自动重放：', event, str(exc), file=sys.stderr)
                    for hand in result.hand_landmarks:
                        for p in hand:
                            cv2.circle(frame, (int(p.x*frame.shape[1]), int(p.y*frame.shape[0])), 3, (100, 255, 150), -1)
                    cv2.putText(frame, f'{name or "None"} score={score:.3f} hold={gate.progress:.0%} frames={gate.frames}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 100), 2)
                    cv2.putText(frame, 'Q: quit | locked: '+str(gate.locked), (10, 60), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 100), 2)
                    cv2.imshow('Smart Care PC gesture input', frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
        return 0
    except (RuntimeError, ValueError, OSError, httpx.HTTPError) as exc:
        print(f'入口错误：{exc}', file=sys.stderr)
        return 1
    finally:
        gate.reset()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == '__main__':
    raise SystemExit(main())
