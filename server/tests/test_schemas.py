import pytest
from pydantic import ValidationError

from app.models.schemas import DeepSkyObject, DsoResponse, Observer


def test_dso_valid_minimum():
    dso = DeepSkyObject(
        id="M31",
        common_name="Andromeda Galaxy",
        type="galaxy",
        ra=10.6847,
        dec=41.2687,
        alt=45.0,
        az=120.0,
        magnitude=3.44,
        angular_size_arcmin=178.0,
    )
    assert dso.source == "SIMBAD/CDS"
    assert dso.minor_axis_arcmin is None
    assert dso.messier_id is None


def test_dso_rejects_invalid_type():
    with pytest.raises(ValidationError):
        DeepSkyObject(
            id="M31",
            common_name="Andromeda",
            type="quasar",  # not in literal
            ra=0, dec=0, alt=0, az=0,
            magnitude=3.44, angular_size_arcmin=10,
        )


def test_dso_response_envelope():
    obs = Observer(lat=40.0, lon=-74.0, datetime="2026-08-15T02:00:00Z")
    resp = DsoResponse(observer=obs, dsos=[], count=0)
    assert resp.count == 0
    assert resp.dsos == []
