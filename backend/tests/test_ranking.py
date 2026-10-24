"""Exercise each priority independently, including stable complete-key ties."""

from datetime import date
from random import Random

import pytest

from app.models import Listing
from app.ranking import rank_listings
from app.repository import load_listings
from app.scoring import calculate_relevance_score

AS_OF_DATE = date(2026, 9, 28)


def make_listing(sample_record: dict[str, object], **changes: object) -> Listing:
    """Validate a fresh sample-based record for a controlled tie case."""
    return Listing.model_validate({**sample_record, **changes})


def test_highest_score_precedes_newer_date(sample_record: dict[str, object]) -> None:
    exact = make_listing(sample_record, id="exact", price=500000)
    newer = make_listing(sample_record, id="newer", price=1000000, listedDate=AS_OF_DATE)
    result = rank_listings([newer, exact], 500000, AS_OF_DATE)
    assert [item.listing.id for item in result] == ["exact", "newer"]
    assert result[0].relevance_score == pytest.approx(
        calculate_relevance_score(exact, 500000, AS_OF_DATE)
    )


def test_equal_scores_use_newer_listed_date(sample_record: dict[str, object]) -> None:
    # Both dates are beyond the recency window, so missing-budget scores tie at zero.
    older = make_listing(sample_record, id="A", listedDate="2025-01-01")
    newer = make_listing(sample_record, id="Z", source="MLS_B", listedDate="2025-02-01")
    result = rank_listings([older, newer], None, AS_OF_DATE)
    assert [item.listing.id for item in result] == ["Z", "A"]
    assert [item.relevance_score for item in result] == [0, 0]


def test_equal_scores_and_dates_use_source_before_id(sample_record: dict[str, object]) -> None:
    a = make_listing(sample_record, source="MLS_A", id="Z")
    b = make_listing(sample_record, source="MLS_B", id="A")
    assert [item.listing.identity for item in rank_listings([b, a], None, AS_OF_DATE)] == [
        ("MLS_A", "Z"), ("MLS_B", "A")
    ]


def test_equal_scores_dates_and_sources_use_id(sample_record: dict[str, object]) -> None:
    records = [make_listing(sample_record, id=value) for value in ["C", "A", "B"]]
    assert [item.listing.id for item in rank_listings(records, None, AS_OF_DATE)] == ["A", "B", "C"]


def test_identical_sort_keys_keep_input_order(sample_record: dict[str, object]) -> None:
    first = make_listing(sample_record, description="First feed version")
    second = make_listing(sample_record, description="Second feed version")
    result = rank_listings([second, first], None, AS_OF_DATE)
    assert result[0].listing is second
    assert result[1].listing is first


@pytest.mark.parametrize("seed", [0, 1, 7, 42])
def test_unique_identities_rank_deterministically_after_shuffle(
    sample_record: dict[str, object], seed: int
) -> None:
    records = [make_listing(sample_record, source=source, id=identifier)
               for source in ["MLS_B", "MLS_A"] for identifier in ["C", "A", "B"]]
    expected = [("MLS_A", "A"), ("MLS_A", "B"), ("MLS_A", "C"),
                ("MLS_B", "A"), ("MLS_B", "B"), ("MLS_B", "C")]
    Random(seed).shuffle(records)
    assert [item.listing.identity for item in rank_listings(records, None, AS_OF_DATE)] == expected


def test_missing_budget_ranks_by_recency(sample_record: dict[str, object]) -> None:
    old = make_listing(sample_record, id="old", price=500000)
    new = make_listing(sample_record, id="new", price=1000000, listedDate=AS_OF_DATE)
    result = rank_listings([old, new], None, AS_OF_DATE)
    assert [item.listing.id for item in result] == ["new", "old"]
    assert result[0].relevance_score == pytest.approx(100)


def test_future_dates_use_actual_dates_for_tie_breaking(sample_record: dict[str, object]) -> None:
    today = make_listing(sample_record, id="today", listedDate=AS_OF_DATE)
    future = make_listing(sample_record, id="future", listedDate="2026-10-01")
    later = make_listing(sample_record, id="later", listedDate="2026-11-01")
    result = rank_listings([today, future, later], None, AS_OF_DATE)
    assert [item.listing.id for item in result] == ["later", "future", "today"]
    assert [item.relevance_score for item in result] == [100, 100, 100]


def test_full_precision_score_precedes_identity_tie_break(sample_record: dict[str, object]) -> None:
    better = make_listing(sample_record, id="Z", price=500000)
    worse = make_listing(sample_record, id="A", price=500001)
    result = rank_listings([worse, better], 500000, AS_OF_DATE)
    assert round(result[0].relevance_score, 2) == round(result[1].relevance_score, 2)
    assert result[0].relevance_score > result[1].relevance_score
    assert result[0].listing is better


def test_ranking_preserves_all_feed_records_and_original_data() -> None:
    records = load_listings()
    objects = list(records)
    before = [listing.model_dump(mode="json") for listing in records]
    result = rank_listings(records, 500000, AS_OF_DATE)
    assert len(result) == 12
    assert {item.listing.identity for item in result} == {listing.identity for listing in records}
    assert [listing.model_dump(mode="json") for listing in records] == before
    assert all(current is original for current, original in zip(records, objects))
    assert all(any(item.listing is listing for listing in records) for item in result)


def test_ranking_empty_collection_returns_empty_list() -> None:
    assert rank_listings([], None, AS_OF_DATE) == []
