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


from app.models.schemas import Star


def test_star_provenance_fields_default_to_none():
    star = Star(
        source_id="123", ra=1.0, dec=2.0, alt=3.0, az=4.0, magnitude=5.0
    )
    assert star.color_source is None
    assert star.magnitude_source is None
    assert star.source == "Gaia DR3"


def test_star_carries_derived_photometry_provenance():
    star = Star(
        source_id="hip:91262", ra=1.0, dec=2.0, alt=3.0, az=4.0, magnitude=0.03,
        source="ESA Hipparcos",
        magnitude_source="Derived from Hipparcos V and B-V via the Gaia EDR3 "
                         "G-V relation (Riello et al. 2021, Table 5.7)",
        color_source="Derived from Hipparcos V-I via the Gaia EDR3 BP-RP "
                      "relation (Riello et al. 2021, Table 5.7)",
    )
    assert star.source_id.startswith("hip:")
    assert "Riello" in star.magnitude_source
