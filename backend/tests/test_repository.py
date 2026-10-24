import json
from pathlib import Path

import pytest

from app.models import Listing
from app.repository import ListingRepositoryError, load_listings


def test_loads_all_sample_records_from_any_working_directory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    listings = load_listings()
    assert len(listings) == 12
    assert all(isinstance(listing, Listing) for listing in listings)
    assert listings[0].identity == ("MLS_A", "A1")
    assert listings[-1].status == "pending"


def test_preserves_apparent_duplicate_properties() -> None:
    listings = load_listings()
    first, second = listings[:2]
    assert first.identity == ("MLS_A", "A1")
    assert second.identity == ("MLS_B", "B7")
    assert first.latitude == second.latitude
    assert first.longitude == second.longitude
    assert first.price != second.price
    assert first.address != second.address


def test_same_id_in_different_sources_remains_separate(tmp_path: Path, sample_record: dict[str, object]) -> None:
    # The sample IDs are all distinct, so reuse A1 in MLS_B to test the stated identity rule.
    path = tmp_path / "listings.json"
    path.write_text(json.dumps([sample_record, {**sample_record, "source": "MLS_B"}]))
    assert [listing.identity for listing in load_listings(path)] == [("MLS_A", "A1"), ("MLS_B", "A1")]


def test_missing_file_reports_read_failure(tmp_path: Path) -> None:
    with pytest.raises(ListingRepositoryError, match="Cannot read listing file") as error:
        load_listings(tmp_path / "missing.json")
    assert isinstance(error.value.__cause__, FileNotFoundError)


@pytest.mark.parametrize("content", ['[{"id":', "not json"])
def test_malformed_json_reports_parse_failure(tmp_path: Path, content: str) -> None:
    path = tmp_path / "listings.json"
    path.write_text(content)
    with pytest.raises(ListingRepositoryError, match="Malformed JSON"):
        load_listings(path)


@pytest.mark.parametrize("content", ['{}', 'null', '42'])
def test_non_array_json_reports_shape_failure(tmp_path: Path, content: str) -> None:
    path = tmp_path / "listings.json"
    path.write_text(content)
    with pytest.raises(ListingRepositoryError, match="must contain a JSON array"):
        load_listings(path)


def test_invalid_record_reports_index_and_field_without_skipping(tmp_path: Path, sample_record: dict[str, object]) -> None:
    path = tmp_path / "listings.json"
    path.write_text(json.dumps([sample_record, {**sample_record, "price": -1}]))
    with pytest.raises(ListingRepositoryError, match="Invalid listing at index 1") as error:
        load_listings(path)
    assert "price" in str(error.value)


def test_non_object_record_is_invalid(tmp_path: Path) -> None:
    path = tmp_path / "listings.json"
    path.write_text('[null]')
    with pytest.raises(ListingRepositoryError, match="Invalid listing at index 0"):
        load_listings(path)


def test_invalid_utf8_reports_read_failure(tmp_path: Path) -> None:
    path = tmp_path / "listings.json"
    path.write_bytes(b'\xff')
    with pytest.raises(ListingRepositoryError, match="Cannot read listing file"):
        load_listings(path)


def test_empty_dataset_is_valid(tmp_path: Path) -> None:
    path = tmp_path / "listings.json"
    path.write_text('[]')
    assert load_listings(path) == []
