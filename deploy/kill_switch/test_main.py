"""Run: python -m pytest deploy/kill_switch -q  (needs functions-framework)."""

import base64
import json

from main import should_cut_billing


def _event(cost, budget):
    data = base64.b64encode(json.dumps({"costAmount": cost, "budgetAmount": budget}).encode())
    return {"message": {"data": data}}


def test_no_cut_under_budget():
    assert should_cut_billing(_event(4.99, 5.0)) is False


def test_cut_at_or_over_budget():
    assert should_cut_billing(_event(5.0, 5.0)) is True
    assert should_cut_billing(_event(12.3, 5.0)) is True
