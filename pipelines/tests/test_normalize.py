from pathlib import Path

from pipelines.src.connectors.sample_colombia import SampleColombiaConnector
from pipelines.src.run_sample import FileHandoffSink
from pipelines.src.normalize.colombia import normalize_city, normalize_row


def test_normalizes_only_pilot_cities_and_preserves_nulls():
    assert normalize_city("Bogota D.C.") == "Bogotá"
    assert normalize_city("Medellin") == "Medellín"
    assert normalize_city("Barranquilla") is None
    result = normalize_row({"city": "Cali", "digital_gap": ""})
    assert result["digital_gap"] is None


def test_connector_contract_is_idempotent_and_sample_is_explicitly_synthetic(tmp_path: Path):
    connector = SampleColombiaConnector(tmp_path)
    descriptor = connector.discover()[0]
    first = connector.acquire(descriptor)
    second = connector.acquire(descriptor)
    assert descriptor.is_synthetic is True
    assert first.checksum == second.checksum
    assert first.path == second.path


def test_raw_validation_rejects_out_of_range_factors(tmp_path: Path):
    source = tmp_path / "invalid.csv"
    sample = (Path(__file__).parents[2] / "data" / "samples" / "colombia_sector_metrics.synthetic.csv").read_text(encoding="utf-8")
    source.write_text(sample.replace("0.78", "1.78", 1), encoding="utf-8")
    connector = SampleColombiaConnector(tmp_path / "raw", source)
    asset = connector.acquire(connector.discover()[0])
    report = connector.validate_raw(asset)
    assert report["passed"] is False
    assert any("digital_gap" in issue for issue in report["issues"])


def test_load_lifecycle_persists_a_normalized_handoff(tmp_path: Path):
    connector = SampleColombiaConnector(tmp_path / "raw")
    asset = connector.acquire(connector.discover()[0])
    batch = connector.normalize(asset)
    result = connector.load(batch, FileHandoffSink(tmp_path / "handoff.json"))
    assert result.rows == 15
    assert Path(result.location).exists()
