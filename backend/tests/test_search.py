"""Service-level checks of orchestration, independent of HTTP handling."""

from datetime import date
from pathlib import Path

import pytest

from app.models import SearchParams
from app.repository import ListingRepositoryError
from app.search import search_listings

AS_OF_DATE = date(2026, 9, 28)


def test_search_service_filters_ranks_then_paginates() -> None:
    params = SearchParams(city="Springfield", maxPrice=500000,
                          targetBudget=500000, page=2, pageSize=1)
    result = search_listings(params, AS_OF_DATE)
    assert [item.listing.identity for item in result.results] == [("MLS_B", "B7")]
    assert result.results[0].relevance_score == pytest.approx(87.94666666666667)
    assert (result.total_count, result.total_pages, result.page, result.page_size) == (2, 2, 2, 1)


def test_search_service_is_repeatable_with_explicit_date() -> None:
    params = SearchParams(targetBudget=500000)
    assert search_listings(params, AS_OF_DATE) == search_listings(params, AS_OF_DATE)


def test_search_service_propagates_repository_failure(tmp_path: Path) -> None:
    with pytest.raises(ListingRepositoryError):
        search_listings(SearchParams(), AS_OF_DATE, tmp_path / "missing.json")


def test_search_service_supports_empty_dataset(tmp_path: Path) -> None:
    path = tmp_path / "empty.json"
    path.write_text('[]')
    result = search_listings(SearchParams(page=3), AS_OF_DATE, path)
    assert result.results == []
    assert (result.total_count, result.total_pages, result.page) == (0, 0, 3)
