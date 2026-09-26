from pipelines.src.official_sources import (
    aggregate_emicron_bogota,
    parse_ica_csv,
    require_emicron_labels,
)
import pytest


def test_emicron_bogota_uses_weight_and_group_12_only():
    rows = ([{"COD_DEPTO": "11", "AREA": "11", "F_EXP": 2, "GRUPOS12": "03"}] * 1909) + [
        {"COD_DEPTO": "05", "AREA": "11", "F_EXP": 999, "GRUPOS12": "03"}
    ]
    result = aggregate_emicron_bogota(rows)
    assert result["unweighted_records"] == 1909
    assert result["weighted_records"] == 3818
    assert result["evidence_type"] == "group_12"
    assert result["ciiu_level"] != "division"


def test_emicron_p_variables_require_registered_labels():
    with pytest.raises(ValueError, match="P4001"):
        require_emicron_labels(["P4001"], {})
    require_emicron_labels(["P4001"], {"P4001": "Uso de internet"})


def test_ica_parser_uses_cp1252_semicolon_and_never_derives_division(tmp_path):
    path = tmp_path / "ica.csv"
    path.write_bytes("CODIGO CIIU SHD;DESCRIPCION CIIU;RECAUDO BIMESTRAL Y/O ANUAL\n1234;Comercio;$1.200\n".encode("cp1252"))
    records = parse_ica_csv(path)
    assert records == [{"source_code": "1234", "source_description": "Comercio", "target_ciiu_division": None, "mapping_status": "unresolved"}]


def test_ica_parser_with_crosswalk_maps_shd_to_verified_division(tmp_path):
    path = tmp_path / "ica.csv"
    content = "CODIGO CIIU SHD;DESCRIPCION CIIU;VIGENCIA;VALOR RECAUDO\n6201;Software;2021;$1.000\n6201;Software;2023;$1.210\n"
    path.write_bytes(content.encode("cp1252"))
    crosswalk = {
        "6201": {
            "source_code": "6201",
            "target_ciiu_division": "62",
            "target_ciiu_class": "6201",
            "mapping_method": "Resolución DDI-000305",
            "evidence_url": "https://www.shd.gov.co",
            "mapping_status": "verified"
        }
    }
    records = parse_ica_csv(path, crosswalk=crosswalk)
    assert len(records) == 2
    assert records[0]["target_ciiu_division"] == "62"
    assert records[0]["mapping_status"] == "verified"
    assert records[0]["recaudo_value"] == 1000.0

    from pipelines.src.official_sources import aggregate_ica_divisions
    metrics = aggregate_ica_divisions(records)
    assert len(metrics) == 1
    m = metrics[0]
    assert m["division_code"] == "62"
    assert m["recaudo_total"] == 2210.0
    assert m["recaudo_reciente"] == 1210.0
    # CAGR from 2021 ($1000) to 2023 ($1210) over 2 years = (1210/1000)^(1/2) - 1 = 10% = 0.10
    assert pytest.approx(m["cagr_dinamismo"], rel=1e-3) == 0.10

