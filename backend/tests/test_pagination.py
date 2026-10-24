"""Page slicing boundaries and real repository/filter/rank/page integration."""

from datetime import date
from random import Random

import pytest
from pydantic import ValidationError

from app.filtering import filter_listings
from app.models import SearchParams
from app.pagination import paginate_listings
from app.ranking import ScoredListing, rank_listings
from app.repository import load_listings

AS_OF_DATE = date(2026, 9, 28)


@pytest.fixture
def ranked() -> list[ScoredListing]:
    """Use all 12 real records in established ranking order."""
    return rank_listings(load_listings(), 500000, AS_OF_DATE)


def test_default_pagination_matches_search_parameter_defaults(ranked: list[ScoredListing]) -> None:
    result = paginate_listings(ranked)
    params = SearchParams()
    assert (result.page, result.page_size) == (params.page, params.page_size) == (1, 10)
    assert result.results == ranked[:10]
    assert (result.total_count, result.total_pages) == (12, 2)


@pytest.mark.parametrize(
    ("page", "size", "start", "end", "total_pages"),
    [(1, 5, 0, 5, 3), (2, 5, 5, 10, 3), (3, 5, 10, 12, 3),
     (4, 5, 12, 12, 3), (100, 5, 12, 12, 3),
     (1, 12, 0, 12, 1), (2, 12, 12, 12, 1),
     (1, 6, 0, 6, 2), (2, 6, 6, 12, 2),
     (12, 1, 11, 12, 12), (13, 1, 12, 12, 12),
     (1, 20, 0, 12, 1), (1, 100000, 0, 12, 1)],
)
def test_page_boundaries_and_metadata(
    ranked: list[ScoredListing], page: int, size: int,
    start: int, end: int, total_pages: int
) -> None:
    result = paginate_listings(ranked, page, size)
    assert result.results == ranked[start:end]
    assert result.total_count == 12
    assert result.total_pages == total_pages
    assert result.page == page
    assert result.page_size == size


@pytest.mark.parametrize("page", [1, 4])
def test_zero_matches_have_zero_pages_and_keep_request(page: int) -> None:
    result = paginate_listings([], page, 5)
    assert result.results == []
    assert (result.total_count, result.total_pages, result.page, result.page_size) == (0, 0, page, 5)


def test_single_record_is_one_page(ranked: list[ScoredListing]) -> None:
    result = paginate_listings(ranked[:1])
    assert result.results == ranked[:1]
    assert (result.total_count, result.total_pages) == (1, 1)


@pytest.mark.parametrize("size", [1, 3, 5, 10, 12, 20])
def test_pages_do_not_skip_or_repeat_records(ranked: list[ScoredListing], size: int) -> None:
    first = paginate_listings(ranked, 1, size)
    combined = [item for page in range(1, first.total_pages + 1)
                for item in paginate_listings(ranked, page, size).results]
    assert combined == ranked
    assert len({item.listing.identity for item in combined}) == 12


def test_pagination_does_not_mutate_order_scores_or_records(ranked: list[ScoredListing]) -> None:
    before = [(item.listing.model_dump(mode="json"), item.relevance_score) for item in ranked]
    objects = list(ranked)
    result = paginate_listings(tuple(ranked), 2, 5)
    assert [(item.listing.model_dump(mode="json"), item.relevance_score) for item in ranked] == before
    assert all(current is original for current, original in zip(ranked, objects))
    assert result.results[0] is ranked[5]
    result.results.clear()
    assert len(ranked) == 12


def test_pagination_reuses_existing_validation(ranked: list[ScoredListing]) -> None:
    # One wiring check; detailed invalid-value coverage already lives in test_models.
    with pytest.raises(ValidationError):
        paginate_listings(ranked, page_size=0)


def test_sample_filter_rank_paginate_pipeline_has_correct_totals() -> None:
    records = load_listings()
    assert len(records) == 12
    params = SearchParams(city="Springfield", maxPrice=500000, targetBudget=500000, pageSize=1)
    filtered = filter_listings(records, params)
    ranked = rank_listings(filtered, params.target_budget, AS_OF_DATE)
    first = paginate_listings(ranked, params.page, params.page_size)
    second = paginate_listings(ranked, 2, params.page_size)
    assert [item.listing.identity for item in first.results] == [("MLS_A", "A1")]
    assert [item.listing.identity for item in second.results] == [("MLS_B", "B7")]
    assert first.results[0].relevance_score == pytest.approx(88)
    assert second.results[0].relevance_score == pytest.approx(87.94666666666667)
    assert (first.total_count, first.total_pages) == (second.total_count, second.total_pages) == (2, 2)


def test_sample_pipeline_ranks_all_matches_before_slicing() -> None:
    records = load_listings()
    params = SearchParams(targetBudget=500000, pageSize=5)
    ordered = rank_listings(filter_listings(records, params), params.target_budget, AS_OF_DATE)
    expected_ids = [("MLS_A", "A2"), ("MLS_A", "A5"), ("MLS_B", "B8"),
                    ("MLS_A", "A1"), ("MLS_B", "B7"), ("MLS_B", "B11"),
                    ("MLS_A", "A7"), ("MLS_B", "B10"), ("MLS_A", "A3"),
                    ("MLS_A", "A4"), ("MLS_B", "B9"), ("MLS_A", "A6")]
    assert [item.listing.identity for item in ordered] == expected_ids
    shuffled = list(records)
    Random(42).shuffle(shuffled)
    reordered = rank_listings(filter_listings(shuffled, params), params.target_budget, AS_OF_DATE)
    pages = [paginate_listings(reordered, page, params.page_size) for page in [1, 2, 3]]
    assert [item.listing.identity for result in pages for item in result.results] == expected_ids
    assert all((result.total_count, result.total_pages) == (12, 3) for result in pages)


def test_no_match_pipeline_returns_empty_page() -> None:
    params = SearchParams(city="Unknown", page=3, pageSize=2)
    ranked = rank_listings(filter_listings(load_listings(), params), None, AS_OF_DATE)
    result = paginate_listings(ranked, params.page, params.page_size)
    assert result.results == []
    assert (result.total_count, result.total_pages, result.page) == (0, 0, 3)
