"""Coordinate the existing search stages without HTTP-specific behavior."""

from datetime import date
from pathlib import Path

from app.filtering import filter_listings
from app.models import SearchParams
from app.pagination import PaginatedResults, paginate_listings
from app.ranking import rank_listings
from app.repository import DEFAULT_DATA_PATH, load_listings


def search_listings(
    params: SearchParams, as_of_date: date, data_path: Path = DEFAULT_DATA_PATH
) -> PaginatedResults:
    """Load, filter, rank, and paginate using one explicit reference date.

    Args:
        params: Validated filters, budget, and pagination inputs.
        as_of_date: Same reference date for every listing scored in this search.
        data_path: Default project dataset or a supplied file for isolated tests.

    Returns:
        Requested scored page with totals for the complete matching set.

    Raises:
        ListingRepositoryError: Dataset loading or validation failed. The HTTP
            boundary is responsible for translating this into a public error.
    """
    listings = load_listings(data_path)
    filtered = filter_listings(listings, params)
    ranked = rank_listings(filtered, params.target_budget, as_of_date)
    return paginate_listings(ranked, params.page, params.page_size)
