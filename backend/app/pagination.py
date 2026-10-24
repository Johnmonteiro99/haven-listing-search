"""Slice already ranked results, keeping metadata for the requested page."""

from collections.abc import Sequence
from dataclasses import dataclass

from app.models import SearchParams
from app.ranking import ScoredListing


@dataclass(frozen=True)
class PaginatedResults:
    """Requested page of scored records and totals for the entire matching set."""

    results: list[ScoredListing]
    total_count: int
    page: int
    page_size: int
    total_pages: int


def paginate_listings(
    listings: Sequence[ScoredListing], page: int = 1, page_size: int = 10
) -> PaginatedResults:
    """Return a slice of ordered scored records with accurate page metadata.

    Args:
        listings: Complete matching set, already ranked before pagination.
        page: One-based requested page; defaults to 1.
        page_size: Positive page size; defaults to 10, with no upper limit.

    Returns:
        A new page list referencing original scored records. Empty sets have
        zero total pages; out-of-range requests keep their page and return [].

    Raises:
        pydantic.ValidationError: Page inputs fail existing SearchParams rules.
    """
    # Reuse the model's rules rather than duplicating numeric validation here.
    params = SearchParams(page=page, pageSize=page_size)
    total_count = len(listings)
    total_pages = (total_count + params.page_size - 1) // params.page_size
    start = (params.page - 1) * params.page_size
    results = list(listings[start:start + params.page_size])
    return PaginatedResults(
        results=results,
        total_count=total_count,
        page=params.page,
        page_size=params.page_size,
        total_pages=total_pages,
    )
