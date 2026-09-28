from app.models.schemas import ExoplanetInfo, ObjectEnrichment, ObjectResponse


def test_object_response_found_with_enrichment():
    resp = ObjectResponse(
        found=True,
        enrichment=ObjectEnrichment(
            source_id="123",
            proper_name="Vega",
            designation="α Lyrae",
            catalog_ids=["HD 172167", "HIP 91262"],
            spectral_type="A0Va",
            object_type="Variable Star",
            planets=None,
            sources=["SIMBAD/CDS"],
        ),
    )
    assert resp.found is True
    assert resp.enrichment.proper_name == "Vega"
    assert resp.enrichment.planets is None


def test_object_response_not_found():
    resp = ObjectResponse(found=False, enrichment=None)
    assert resp.found is False
    assert resp.enrichment is None


def test_exoplanet_info_defaults():
    info = ExoplanetInfo(count=3, names=["51 Peg b"])
    assert info.count == 3
    assert info.names == ["51 Peg b"]
