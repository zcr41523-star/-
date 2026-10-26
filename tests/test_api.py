from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from backend.app import create_app

TOKEN = 'test-token-at-least-16'


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path/'test.db', TOKEN)) as c:
        c.headers['Authorization'] = 'Bearer '+TOKEN
        yield c


def event(action, source='browser', id=None):
    return dict(id=id or str(uuid4()), action=action, source=source)


def test_fall_cancel_light_and_dedup(client):
    assert client.get('/api/health').json()['status'] == 'ok'
    fall = event('FALL_DETECTED', 'fall')
    r = client.post('/api/events', json=fall)
    assert r.status_code == 200 and r.json()['state']['alert']
    assert client.post('/api/events', json=fall).json()['duplicate']
    assert client.get('/api/state').json()['revision'] == 1
    assert not client.post('/api/events', json=event('CANCEL_ALERT')).json()['state']['alert']
    assert client.post('/api/events', json=event('LIGHT_ON')).json()['state']['light']
    assert not client.post('/api/events', json=event('LIGHT_OFF')).json()['state']['light']
    assert client.post('/api/events', json=event('HELP')).json()['state']['alert']


def test_validation_auth_modes(client):
    assert client.get('/api/state', headers={'Authorization': ''}).status_code == 401
    assert client.post('/api/events', json=event('HELP'), headers={'Authorization': 'Bearer wrong'}).status_code == 401
    for body in [event('BOGUS'), event('HELP', id='bad'), {**event('HELP'), 'extra': 1}]:
        assert client.post('/api/events', json=body).status_code == 422
    assert client.post('/api/events', json=event('FALL_DETECTED')).status_code == 422
    assert client.post('/api/events', json=event('HELP', 'fall')).status_code == 422
    assert client.post('/api/events', json=event('HELP', 'pc')).status_code == 409
    assert client.post('/api/events', json=event('HELP', 'simulation')).status_code == 409


def test_conflicting_id(client):
    first = event('HELP')
    client.post('/api/events', json=first)
    assert client.post('/api/events', json={**first, 'action': 'CANCEL_ALERT'}).status_code == 409


def test_concurrent_duplicate(client):
    e = event('HELP')
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: client.post('/api/events', json=e), range(8)))
    assert all(r.status_code == 200 for r in results)
    assert sum(not r.json()['duplicate'] for r in results) == 1
    assert client.get('/api/state').json()['revision'] == 1


def test_persistence_and_pc_mode(tmp_path):
    path = tmp_path/'persist.db'
    for index in range(2):
        c = TestClient(create_app(path, TOKEN, 'pc'))
        c.headers['Authorization'] = 'Bearer '+TOKEN
        if not index:
            assert c.post('/api/events', json=event('LIGHT_ON', 'pc')).status_code == 200
        assert c.get('/api/state').json()['light']
        assert c.post('/api/events', json=event('HELP')).status_code == 409


def test_missing_token(tmp_path, monkeypatch):
    monkeypatch.delenv('CARE_TOKEN', raising=False)
    with pytest.raises(RuntimeError):
        create_app(tmp_path/'none.db')
