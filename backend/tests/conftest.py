"""Use actual feed data as a baseline for focused validation cases."""

import json

import pytest

from app.repository import DEFAULT_DATA_PATH


@pytest.fixture
def sample_record() -> dict[str, object]:
    """Return a fresh copy of A1 for each test that changes a field."""
    return json.loads(DEFAULT_DATA_PATH.read_text(encoding="utf-8"))[0]

