"""Deterministic relevance scoring, independent of filtering and file access."""

from datetime import date

from app.models import Listing

BUDGET_WEIGHT = 0.70
RECENCY_WEIGHT = 0.30
RECENCY_WINDOW_DAYS = 180


def calculate_relevance_score(
    listing: Listing, target_budget: float | None, as_of_date: date
) -> float:
    """Score one validated listing using budget proximity and calendar-day age.

    Args:
        listing: Validated record with a nonnegative finite price and a date.
        target_budget: Positive finite budget validated by SearchParams, or None.
        as_of_date: Explicit reference date; the function never reads the clock.

    Returns:
        An unrounded float in [0, 100]. Budget contributes 70% and recency 30%
        when supplied; without a budget, recency alone determines the score.
        Dates in the future count as new listings. No record is modified.
    """
    # Future dates receive the same recency as a listing posted today.
    age_days = max(0, (as_of_date - listing.listed_date).days)
    recency_score = 100 * max(0, 1 - age_days / RECENCY_WINDOW_DAYS)

    if target_budget is None:
        return recency_score

    # Absolute distance treats equally distant prices above/below budget alike.
    budget_score = 100 * max(
        0, 1 - abs(listing.price - target_budget) / target_budget
    )
    relevance_score = BUDGET_WEIGHT * budget_score + RECENCY_WEIGHT * recency_score
    return min(100.0, max(0.0, relevance_score))
