"""单进程 SQLite 事件状态服务。令牌、输入模式与 CORS 在启动时从环境读取。"""
import hmac
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Event(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    action: Literal['HELP', 'CANCEL_ALERT', 'LIGHT_ON', 'LIGHT_OFF', 'FALL_DETECTED']
    source: Literal['browser', 'pc', 'fall', 'simulation']


def create_app(db_path=None, token=None, input_mode=None):
    secret = token if token is not None else os.getenv('CARE_TOKEN', '')
    if len(secret) < 16:
        raise RuntimeError('请设置 CARE_TOKEN，至少 16 个字符；不要把令牌提交到 Git。')
    mode = input_mode or os.getenv('CARE_INPUT_MODE', 'browser')
    if mode not in ('browser', 'pc'):
        raise RuntimeError('CARE_INPUT_MODE 必须为 browser 或 pc')
    path = str(db_path or os.getenv('CARE_DB', str(ROOT/'work/care.sqlite3')))
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        db.executescript('''CREATE TABLE IF NOT EXISTS events
          (id TEXT PRIMARY KEY, payload TEXT NOT NULL, received_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS state
          (id INTEGER PRIMARY KEY CHECK(id=1), alert INTEGER NOT NULL, light INTEGER NOT NULL,
           revision INTEGER NOT NULL, last_event_id TEXT);
          INSERT OR IGNORE INTO state VALUES (1,0,0,0,NULL);''')
    app = FastAPI(title='Smart Care B 模块', version='1.0.0')
    origins = [s.strip() for s in os.getenv('CARE_ORIGINS', 'http://localhost:8000,http://127.0.0.1:8000').split(',') if s.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET', 'POST'], allow_headers=['Authorization', 'Content-Type'])

    def auth(authorization: str = Header(default='')):
        if not hmac.compare_digest(authorization.encode(), ('Bearer '+secret).encode()):
            raise HTTPException(401, '需要有效的 Bearer 令牌')

    def state(db):
        row = db.execute('SELECT alert,light,revision,last_event_id FROM state WHERE id=1').fetchone()
        return dict(alert=bool(row[0]), light=bool(row[1]), revision=row[2], last_event_id=row[3], input_mode=mode)

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'input_mode': mode, 'version': '1.0.0'}

    @app.get('/api/state', dependencies=[Depends(auth)])
    def get_state():
        with sqlite3.connect(path) as db:
            return state(db)

    @app.post('/api/events', dependencies=[Depends(auth)])
    def event(e: Event):
        if (e.action == 'FALL_DETECTED') != (e.source == 'fall'):
            raise HTTPException(422, 'FALL_DETECTED 必须来自 fall；fall 只能提交跌倒事件')
        if e.source not in ('fall', mode):
            raise HTTPException(409, '输入模式不匹配；模拟操作仅在浏览器本地演示，不提交共享后端')
        payload = json.dumps(e.model_dump(mode='json'), sort_keys=True)
        with sqlite3.connect(path, timeout=10) as db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT payload FROM events WHERE id=?', (str(e.id),)).fetchone()
            if old:
                if old[0] != payload:
                    raise HTTPException(409, '同一事件 ID 的内容不一致')
                return {'duplicate': True, 'state': state(db)}
            current = state(db)
            alert, light = current['alert'], current['light']
            if e.action in ('HELP', 'FALL_DETECTED'):
                alert = True
            elif e.action == 'CANCEL_ALERT':
                alert = False
            elif e.action == 'LIGHT_ON':
                light = True
            elif e.action == 'LIGHT_OFF':
                light = False
            db.execute('INSERT INTO events VALUES (?,?,?)', (str(e.id), payload, datetime.now(timezone.utc).isoformat()))
            db.execute('UPDATE state SET alert=?,light=?,revision=revision+1,last_event_id=? WHERE id=1', (alert, light, str(e.id)))
            return {'duplicate': False, 'state': state(db)}

    app.mount('/', StaticFiles(directory=ROOT/'docs', html=True), name='frontend')
    return app
