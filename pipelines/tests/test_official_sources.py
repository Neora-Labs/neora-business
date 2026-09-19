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
