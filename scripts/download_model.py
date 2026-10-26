"""下载 Google 官方固定版本模型；模型校验值保存在仓库中。"""
import hashlib
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task'


def main():
    target = ROOT/'docs/models/gesture_recognizer.task'
    target.parent.mkdir(parents=True, exist_ok=True)
    data = urlopen(URL, timeout=120).read()
    digest = hashlib.sha256(data).hexdigest()
    checksum = ROOT/'docs/models/SHA256SUMS'
    if checksum.exists() and checksum.read_text().split()[0] != digest:
        raise RuntimeError('模型 SHA256 不一致，未覆盖旧模型')
    target.write_bytes(data)
    checksum.write_text(f'{digest}  gesture_recognizer.task\n')
    print(f'已下载 {len(data)} bytes；SHA256 {digest}')


if __name__ == '__main__':
    main()
