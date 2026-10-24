"""Rank listings deterministically using the shared relevance calculation."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from app.models import Listing
from app.scoring import calculate_relevance_score


@dataclass(frozen=True)
class ScoredListing:
    """Associate the original feed record with its unrounded relevance score."""

    listing: Listing
    relevance_score: float


def rank_listings(
    listings: Sequence[Listing], target_budget: float | None, as_of_date: date
) -> list[ScoredListing]:
    """Score records and return a new ordered list without modifying inputs.

    The budget must already be validated by SearchParams. Priorities are score
    descending, actual listed date descending, source ascending, then ID
    ascending. Future dates keep their actual value for date tie-breaking,
    although scoring treats them as age zero. Equal complete keys retain input
    order because Python sorting is stable. Records are never deduplicated.
    """
    scored = [
        ScoredListing(listing, calculate_relevance_score(listing, target_budget, as_of_date))
        for listing in listings
    ]
    # Negation reverses only the numeric/date priorities, leaving text ascending.
    return sorted(scored, key=lambda item: (
        -item.relevance_score,
        -item.listing.listed_date.toordinal(),
        item.listing.source,
        item.listing.id,
    ))
