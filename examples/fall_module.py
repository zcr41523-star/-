"""只有事件上报，不包含跌倒识别算法。一次跌倒 episode 只创建一个 UUID。"""
import os
import time
from uuid import uuid4

import httpx


def report_fall(client, episode_id):
    # 网络重试时必须复用 episode_id，而不是每帧创建新事件。
    r = client.post('/api/events', json={'id': episode_id, 'action': 'FALL_DETECTED', 'source': 'fall'})
    r.raise_for_status()
    return r.json()


def main():
    with httpx.Client(base_url=os.getenv('CARE_URL', 'http://127.0.0.1:8000'),
                      headers={'Authorization': 'Bearer '+os.environ['CARE_TOKEN']}, timeout=5) as client:
        episode_id = str(uuid4())  # 在 A 模块的“新跌倒事件”状态转换时创建并保存。
        print('上报一次跌倒：', report_fall(client, episode_id))
        print('请通过 B 模块保持 V 字 2 秒，等待取消（Ctrl+C 结束）。')
        while True:
            r = client.get('/api/state')
            r.raise_for_status()
            state = r.json()
            print(state)
            if not state['alert']:
                print('已读取到取消后的状态。')
                break
            time.sleep(1)


if __name__ == '__main__':
    main()
