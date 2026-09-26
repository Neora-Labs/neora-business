from pipelines.src.official_worker import process_emicron_csv, process_ica_csv
from pathlib import Path
import pytest


def test_worker_rejects_unlabelled_p_variables(tmp_path: Path):
    source = tmp_path / "emicron.csv"
    source.write_text("COD_DEPTO,AREA,F_EXP,GRUPOS12,P4001\n11,11,2,03,1\n", encoding="utf-8")
    with pytest.raises(ValueError, match="P4001"):
        process_emicron_csv(source, {}, ["P4001"])


def test_ica_worker_never_emits_division_metrics_without_crosswalk(tmp_path: Path):
    source = tmp_path / "ica.csv"
    source.write_bytes("CODIGO CIIU SHD;DESCRIPCION CIIU\n1234;Comercio\n".encode("cp1252"))
    result = process_ica_csv(source)
    assert result["status"] == "blocked_mapping"
    assert result["metric_rows"] == []


def test_ica_worker_emits_division_metrics_with_crosswalk(tmp_path: Path):
    source = tmp_path / "ica.csv"
    source.write_bytes("CODIGO CIIU SHD;DESCRIPCION CIIU;VIGENCIA;VALOR\n6201;Software;2023;1000\n".encode("cp1252"))
    crosswalk = {
        "6201": {
            "source_code": "6201",
            "target_ciiu_division": "62",
            "mapping_status": "verified"
        }
    }
    result = process_ica_csv(source, crosswalk=crosswalk)
    assert result["status"] == "completed"
    assert len(result["metric_rows"]) == 1
    assert result["metric_rows"][0]["division_code"] == "62"
    assert result["metric_rows"][0]["recaudo_total"] == 1000.0

