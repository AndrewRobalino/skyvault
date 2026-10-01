from scripts.ingest_star_enrichment import (
    format_bayer,
    build_name_fields,
    parse_iau_csn,
    merge_enrichment,
    name_source_for,
)


def test_format_bayer_expands_greek_abbreviation():
    assert format_bayer("* alf Lyr") == "α Lyrae"
    assert format_bayer("* bet Ori") == "β Orionis"


def test_format_bayer_passthrough_when_no_greek():
    # Flamsteed-number designations have no Greek letter to expand.
    assert format_bayer("* 51 Peg") == "51 Pegasi"


def test_build_name_fields_picks_proper_name_and_designation():
    identifiers = [
        "NAME Vega",
        "* alf Lyr",
        "HD 172167",
        "HIP 91262",
        "TYC 3105-2070-1",
    ]
    proper, designation, catalog_ids = build_name_fields(identifiers)
    assert proper == "Vega"
    assert designation == "α Lyrae"
    assert catalog_ids == ["HD 172167", "HIP 91262"]


def test_build_name_fields_no_proper_name():
    identifiers = ["HD 999999", "* 12 Tau"]
    proper, designation, catalog_ids = build_name_fields(identifiers)
    assert proper is None
    assert designation == "12 Tauri"
    assert catalog_ids == ["HD 999999"]


def test_build_name_fields_collapses_simbad_padding():
    """SIMBAD right-aligns catalog numbers to fixed width ('HD   3712').

    Rendered verbatim the tooltip subtitle reads 'α Cassiopeiae · HD   3712'.
    """
    proper, designation, catalog_ids = build_name_fields(
        ["HD   3712", "HIP  3179"]
    )
    assert catalog_ids == ["HD 3712", "HIP 3179"]


def test_build_name_fields_orders_hd_before_hip():
    """The tooltip shows catalog_ids[0], so the order must be deterministic.

    SIMBAD returns identifiers in no guaranteed order — without this, the
    subtitle flips between HD and HIP from star to star.
    """
    _, _, catalog_ids = build_name_fields(["HIP 67301", "HD 120315"])
    assert catalog_ids == ["HD 120315", "HIP 67301"]

    _, _, catalog_ids = build_name_fields(["HD 209952", "HIP 109268"])
    assert catalog_ids == ["HD 209952", "HIP 109268"]


def test_format_bayer_keeps_component_suffix():
    # Previously the trailing "A" was read as the constellation: "α A".
    assert format_bayer("* alf CMa A") == "α Canis Majoris A"


def test_format_bayer_renders_numbered_bayer_superscript():
    assert format_bayer("* alf01 Cen") == "α¹ Centauri"
    assert format_bayer("* pi.02 Ori") == "π² Orionis"


def test_format_bayer_tolerates_simbad_padding():
    assert format_bayer("*   1 UMi") == "1 Ursae Minoris"


# Real SIMBAD identifier lists, in the order the TAP service returned them.
POLARIS = ["NAME Lodestar", "*   1 UMi", "* alf UMi", "NAME Polaris",
           "NAME North Star", "HD   8890", "HIP 11767"]
SIRIUS = ["* alf CMa A", "NAME Sirius A", "* alf CMa", "*   9 CMa",
          "NAME Sirius", "HD  48915", "HIP 32349"]
BETELGEUSE = ["*  58 Ori", "* alf Ori", "NAME Betelgeuse", "HD  39801", "HIP 27989"]


def test_designation_prefers_bayer_over_flamsteed():
    assert build_name_fields(BETELGEUSE)[1] == "α Orionis"
    assert build_name_fields(POLARIS)[1] == "α Ursae Minoris"


def test_designation_prefers_whole_system_over_component():
    assert build_name_fields(SIRIUS)[1] == "α Canis Majoris"


def test_proper_name_prefers_whole_system_over_component():
    assert build_name_fields(SIRIUS)[0] == "Sirius"


def test_proper_name_choice_does_not_depend_on_simbad_order():
    assert build_name_fields(POLARIS)[0] == build_name_fields(POLARIS[::-1])[0]


def test_iau_name_wins_over_simbad_names():
    iau = {"HIP 11767": "Polaris"}
    assert build_name_fields(POLARIS, iau_names=iau)[0] == "Polaris"


def test_iau_name_matches_on_hd_when_hip_is_absent():
    iau = {"HD 8890": "Polaris"}
    assert build_name_fields(POLARIS, iau_names=iau)[0] == "Polaris"


def test_iau_name_assigned_even_when_simbad_has_no_name():
    iau = {"HD 999999": "Tevel"}
    assert build_name_fields(["HD 999999", "* 12 Tau"], iau_names=iau)[0] == "Tevel"


def test_merge_enrichment_combines_simbad_and_planets():
    simbad = {
        "2835000000000000000": {
            "proper_name": "51 Pegasi",
            "designation": "51 Peg",
            "catalog_ids": ["HD 217014"],
            "spectral_type": "G2IV",
            "object_type": "High Proper Motion Star",
        }
    }
    planets = {"2835000000000000000": {"count": 1, "names": ["51 Peg b"]}}
    merged = merge_enrichment(simbad, planets)
    entry = merged["2835000000000000000"]
    assert entry["planets"] == {"count": 1, "names": ["51 Peg b"]}
    assert entry["name_source"] == "SIMBAD/CDS"
    assert entry["planet_source"] == "NASA Exoplanet Archive"


def test_merge_enrichment_star_without_planets_has_no_planet_source():
    simbad = {"4000000000000000000": {"proper_name": None, "spectral_type": "K0"}}
    merged = merge_enrichment(simbad, {})
    entry = merged["4000000000000000000"]
    assert entry["planets"] is None
    assert entry["planet_source"] is None
    assert entry["name_source"] == "SIMBAD/CDS"


def test_merge_enrichment_accepts_hip_prefixed_keys():
    """hip: ids must flow through the merge unchanged — they key the same file."""
    simbad = {
        "hip:91262": {
            "proper_name": "Vega",
            "designation": "α Lyrae",
            "catalog_ids": ["HD 172167", "HIP 91262"],
            "spectral_type": "A0Va",
            "object_type": "Variable Star",
        }
    }
    merged = merge_enrichment(simbad, {})
    entry = merged["hip:91262"]
    assert entry["proper_name"] == "Vega"
    assert entry["name_source"] == "SIMBAD/CDS"
    assert entry["planets"] is None


# Verbatim rows from the IAU-CSN file, including a star with no HIP/HD.
IAU_CSN_SAMPLE = """\
#Name/ASCII       Name/Diacritics   Designation  ID    ID    Con #    WDS_J       mag  bnd  HIP     HD  RA(J2000)  Dec(J2000) Date       Notes
Absolutno         Absolutno         XO-5         _     _     Lyn _    _          11.95  G      _      _ 116.716506  39.094572 2019-12-17 
Achernar          Achernar          HR 472       alf   α     Eri A    _           0.45  V   7588  10144  24.428523 -57.236753 2016-06-30 
Rigil Kentaurus   Rigil Kentaurus   HR 5459      alf   α     Cen A    14396-6050 -0.01  V  71683 128620 219.902066 -60.833975 2016-11-06 * 
"""


def test_parse_iau_csn_keys_names_by_hip_and_hd():
    names = parse_iau_csn(IAU_CSN_SAMPLE)
    assert names["HIP 7588"] == "Achernar"
    assert names["HD 10144"] == "Achernar"
    assert names["HIP 71683"] == "Rigil Kentaurus"
    assert names["HD 128620"] == "Rigil Kentaurus"


def test_parse_iau_csn_skips_missing_ids():
    names = parse_iau_csn(IAU_CSN_SAMPLE)
    assert "Absolutno" not in names.values()
    assert not any(k.endswith("_") for k in names)


def test_vendored_iau_csn_parses_completely():
    from app.config import DATA_DIR

    text = (DATA_DIR / "sources" / "iau_csn.txt").read_text(encoding="utf-8")
    names = parse_iau_csn(text)
    assert names["HIP 11767"] == "Polaris"
    assert names["HIP 32349"] == "Sirius"
    assert names["HIP 27989"] == "Betelgeuse"
    # 452 names; all but the faint exoplanet hosts carry a HIP number.
    assert len({v for k, v in names.items() if k.startswith("HIP ")}) > 400


def test_format_bayer_uses_simbads_spelling_of_theta_and_xi():
    # SIMBAD writes θ as 'tet' and ξ as 'ksi'; 126 naked-eye stars use them.
    assert format_bayer("* tet Leo") == "θ Leonis"
    assert format_bayer("* ksi Tau") == "ξ Tauri"
    assert format_bayer("* tet02 Tau") == "θ² Tauri"


def test_name_source_credits_iau_when_the_name_came_from_it():
    iau = {"HIP 11767": "Polaris"}
    assert name_source_for(["HD 8890", "HIP 11767"], iau) == "IAU WGSN · SIMBAD/CDS"


def test_name_source_is_simbad_otherwise():
    assert name_source_for(["HD 1"], {"HIP 11767": "Polaris"}) == "SIMBAD/CDS"
    assert name_source_for(["HD 1"], None) == "SIMBAD/CDS"


def test_merge_enrichment_keeps_a_per_star_name_source():
    simbad = {"hip:11767": {"proper_name": "Polaris", "name_source": "IAU WGSN · SIMBAD/CDS"}}
    assert merge_enrichment(simbad, {})["hip:11767"]["name_source"] == "IAU WGSN · SIMBAD/CDS"
