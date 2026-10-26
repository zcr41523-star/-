import copy
import json
from pathlib import Path
import pytest
from backend.gate import CONFIG, GestureGate

CASES = json.loads((Path(__file__).with_name('gate_cases.json')).read_text())


@pytest.mark.parametrize('case', CASES, ids=lambda c: c['name'])
def test_contract(case):
    config = copy.deepcopy(CONFIG)
    config.update(case.get('config', {}))
    gate = GestureGate(config)
    actions = []
    for step in case['steps']:
        if step == 'reset':
            gate.reset()
        else:
            action = gate.update(*step)
            if action:
                actions.append(action)
    assert actions == case['expected']
