"""Unit tests for the shared observation-time parser."""

from __future__ import annotations

import pytest

from app.services.time_utils import InvalidObservationTimeError, parse_utc_time


def test_parses_z_suffix():
    t = parse_utc_time("2026-01-15T02:00:00Z")
    assert t.scale == "utc"
    assert t.isot.startswith("2026-01-15T02:00:00")


def test_parses_z_suffix_with_milliseconds():
    # The frontend sends Date.toISOString() output, which includes millis.
    t = parse_utc_time("2026-01-15T02:00:00.000Z")
    assert t.isot.startswith("2026-01-15T02:00:00")


def test_parses_utc_offset_form():
    # "+00:00" is valid ISO 8601 UTC — must not 500 just because it isn't "Z".
    t_offset = parse_utc_time("2026-01-15T02:00:00+00:00")
    t_z = parse_utc_time("2026-01-15T02:00:00Z")
    assert abs((t_offset - t_z).sec) < 1e-6


def test_converts_nonzero_offset_to_utc():
    # 21:00 at UTC-5 == 02:00 UTC the next day.
    t = parse_utc_time("2026-01-14T21:00:00-05:00")
    assert t.isot.startswith("2026-01-15T02:00:00")


def test_naive_string_assumed_utc():
    t = parse_utc_time("2026-01-15T02:00:00")
    assert t.isot.startswith("2026-01-15T02:00:00")


@pytest.mark.parametrize(
    "bad",
    ["", "not-a-date", "2026-13-45T99:99:99Z", "15/01/2026 02:00"],
)
def test_rejects_malformed_strings(bad: str):
    with pytest.raises(InvalidObservationTimeError):
        parse_utc_time(bad)
