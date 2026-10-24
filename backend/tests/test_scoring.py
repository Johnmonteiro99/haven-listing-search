"""Fixed dates and explicit expected values make scoring tests reproducible."""

from datetime import date, timedelta

import pytest

from app.models import Listing, SearchParams
from app.repository import load_listings
from app.scoring import calculate_relevance_score

AS_OF_DATE = date(2026, 9, 28)


@pytest.fixture
def listing(sample_record: dict[str, object]) -> Listing:
    """Use A1 as a validated baseline; its age is 30 days at the reference date."""
    return Listing.model_validate(sample_record)


@pytest.mark.parametrize(
    ("price", "expected"),
    [(500000, 70), (400000, 56), (600000, 56), (1000000, 0),
     (1500000, 0), (0, 0)],
)
def test_budget_proximity_at_zero_recency(
    listing: Listing, price: float, expected: float
) -> None:
    # An old listing isolates the budget contribution without a component API.
    record = Listing.model_validate({
        **listing.model_dump(), "price": price,
        "listedDate": AS_OF_DATE - timedelta(days=180),
    })
    budget = SearchParams(targetBudget=500000).target_budget
    assert calculate_relevance_score(record, budget, AS_OF_DATE) == pytest.approx(expected)


def test_equally_distant_prices_have_equal_scores(listing: Listing) -> None:
    below = Listing.model_validate({**listing.model_dump(), "price": 450000})
    above = Listing.model_validate({**listing.model_dump(), "price": 550000})
    assert calculate_relevance_score(below, 500000, AS_OF_DATE) == pytest.approx(
        calculate_relevance_score(above, 500000, AS_OF_DATE)
    )


@pytest.mark.parametrize(
    ("age_days", "expected"),
    [(0, 100), (30, 83.33333333333333), (90, 50), (180, 0),
     (181, 0), (1000, 0), (-1, 100), (-30, 100)],
)
def test_recency_without_budget(
    listing: Listing, age_days: int, expected: float
) -> None:
    record = Listing.model_validate({
        **listing.model_dump(), "listedDate": AS_OF_DATE - timedelta(days=age_days),
    })
    assert calculate_relevance_score(record, None, AS_OF_DATE) == pytest.approx(expected)


def test_requested_weighted_example_is_88(listing: Listing) -> None:
    assert listing.price == 450000
    assert (AS_OF_DATE - listing.listed_date).days == 30
    # Budget 90 and recency 83 1/3 contribute 63 and 25 respectively.
    assert calculate_relevance_score(listing, 500000, AS_OF_DATE) == pytest.approx(88)


def test_exact_budget_match_for_new_listing_is_100(listing: Listing) -> None:
    assert calculate_relevance_score(listing, 450000, listing.listed_date) == pytest.approx(100)


def test_future_listing_with_budget_counts_as_new(listing: Listing) -> None:
    assert calculate_relevance_score(listing, 500000, date(2026, 8, 1)) == pytest.approx(93)


def test_missing_budget_uses_full_recency_weight(listing: Listing) -> None:
    params = SearchParams()
    assert calculate_relevance_score(listing, params.target_budget, AS_OF_DATE) == pytest.approx(
        83.33333333333333
    )


def test_intermediate_precision_is_not_rounded(listing: Listing) -> None:
    record = Listing.model_validate({**listing.model_dump(), "price": 452000,
                                    "listedDate": date(2026, 8, 27)})
    score = calculate_relevance_score(record, 500000, AS_OF_DATE)
    assert score == pytest.approx(87.94666666666667, abs=1e-12)
    assert score != round(score, 2)


@pytest.mark.parametrize("price", [0, 1, 450000, 900000, 1e308])
@pytest.mark.parametrize("budget", [None, 1e-308, 450000, 1e308])
def test_scores_remain_bounded_for_valid_prices_and_budgets(
    listing: Listing, price: float, budget: float | None
) -> None:
    record = Listing.model_validate({**listing.model_dump(), "price": price})
    # Extreme but finite values may overflow the distance ratio to infinity;
    # the zero floor still gives a finite, bounded relevance score.
    score = calculate_relevance_score(record, budget, AS_OF_DATE)
    assert 0 <= score <= 100


def test_fixed_reference_date_is_deterministic(listing: Listing) -> None:
    first = calculate_relevance_score(listing, 500000, AS_OF_DATE)
    second = calculate_relevance_score(listing, 500000, AS_OF_DATE)
    assert first == second
    assert first == calculate_relevance_score(
        Listing.model_validate(listing.model_dump()), 500000, AS_OF_DATE
    )
    assert calculate_relevance_score(listing, 500000, AS_OF_DATE + timedelta(days=1)) < first


def test_distinct_feed_records_can_have_tied_scores(listing: Listing) -> None:
    other = Listing.model_validate({**listing.model_dump(), "source": "MLS_B", "id": "T1"})
    assert listing.identity != other.identity
    assert calculate_relevance_score(listing, 500000, AS_OF_DATE) == calculate_relevance_score(
        other, 500000, AS_OF_DATE
    )


def test_scoring_does_not_mutate_listing(listing: Listing) -> None:
    before = listing.model_dump(mode="json")
    calculate_relevance_score(listing, 500000, AS_OF_DATE)
    calculate_relevance_score(listing, None, AS_OF_DATE)
    assert listing.model_dump(mode="json") == before


def test_real_sample_records_match_worked_examples() -> None:
    first, second = load_listings()[:2]
    assert first.identity == ("MLS_A", "A1")
    assert second.identity == ("MLS_B", "B7")
    assert calculate_relevance_score(first, 500000, AS_OF_DATE) == pytest.approx(88)
    assert calculate_relevance_score(second, 500000, AS_OF_DATE) == pytest.approx(87.94666666666667)


def test_all_sample_listings_can_be_scored_without_mutation() -> None:
    records = load_listings()
    before = [listing.model_dump(mode="json") for listing in records]
    scores = [calculate_relevance_score(listing, 500000, AS_OF_DATE) for listing in records]
    assert len(scores) == 12
    assert all(0 <= score <= 100 for score in scores)
    assert [listing.model_dump(mode="json") for listing in records] == before
