"""Filter behavior against the supplied feed and focused synthetic edge cases."""

import pytest

from app.filtering import filter_listings
from app.models import Listing, SearchParams
from app.repository import load_listings


@pytest.fixture
def listings() -> list[Listing]:
    """Load fresh validated sample records without changing the source file."""
    return load_listings()


def test_no_filters_returns_all_records_in_new_list(listings: list[Listing]) -> None:
    result = filter_listings(listings, SearchParams())
    assert len(result) == 12
    assert result == listings
    assert result is not listings


@pytest.mark.parametrize(
    ("values", "expected_ids"),
    [
        ({"minPrice": 540000}, ["A4", "B10", "A7"]),
        ({"maxPrice": 415000}, ["A3", "B9", "A6"]),
        ({"minPrice": 450000, "maxPrice": 450000}, ["A1"]),
        ({"minBedrooms": 4}, ["A4", "A7"]),
        ({"minBedrooms": 3}, ["A2", "B8", "A4", "B10", "A5", "B11", "A6", "A7"]),
        ({"minPrice": 0, "minBedrooms": 0}, ["A1", "B7", "A2", "B8", "A3", "B9", "A4", "B10", "A5", "B11", "A6", "A7"]),
        ({"maxPrice": 0}, []),
        ({"city": "sPrInGfIeLd"}, ["A1", "B7", "A2", "B8"]),
        ({"city": " \tSpringfield\n"}, ["A1", "B7", "A2", "B8"]),
        ({"city": "Spring"}, []),
        ({"keyword": "KiTcHeN"}, ["A2", "B8"]),
        ({"keyword": "itchen"}, ["A2", "B8"]),
        ({"keyword": "  KITCHEN \t"}, ["A2", "B8"]),
        ({"keyword": "Springfield"}, []),
        ({"keyword": "123 Main"}, []),
        ({"keyword": "pets"}, ["B7", "A3", "B9", "A4", "A5", "A6", "A7"]),
        ({"city": "Springfield", "minPrice": 500000, "maxPrice": 530000,
          "minBedrooms": 3, "keyword": "kitchen"}, ["A2", "B8"]),
        ({"city": "Springfield", "keyword": "garage"}, []),
        ({"city": "Unknown city"}, []),
    ],
)
def test_filters_sample_records(
    listings: list[Listing], values: dict[str, object], expected_ids: list[str]
) -> None:
    result = filter_listings(listings, SearchParams.model_validate(values))
    assert [listing.id for listing in result] == expected_ids


def test_springfield_price_example_preserves_both_sources(listings: list[Listing]) -> None:
    result = filter_listings(listings, SearchParams(city="Springfield", maxPrice=500000))
    assert [listing.identity for listing in result] == [("MLS_A", "A1"), ("MLS_B", "B7")]


@pytest.mark.parametrize("text", ["", " ", "\n\t"])
def test_blank_optional_text_does_not_restrict_results(listings: list[Listing], text: str) -> None:
    assert filter_listings(listings, SearchParams(city=text, keyword=text)) == listings


def test_trims_listing_city_without_changing_it(sample_record: dict[str, object]) -> None:
    listing = Listing.model_validate({**sample_record, "city": "  SpRinGfield\t"})
    assert filter_listings([listing], SearchParams(city=" Springfield ")) == [listing]
    assert listing.city == "  SpRinGfield\t"


def test_unicode_case_insensitive_matching(sample_record: dict[str, object]) -> None:
    # casefold handles case equivalents that lower() misses, such as ß and SS.
    listing = Listing.model_validate({**sample_record, "city": "Straße", "description": "Große rooms"})
    assert filter_listings([listing], SearchParams(city="STRASSE", keyword="GROSSE")) == [listing]


def test_keyword_preserves_internal_spaces(sample_record: dict[str, object]) -> None:
    listing = Listing.model_validate({**sample_record, "description": "Pet friendly home"})
    assert filter_listings([listing], SearchParams(keyword="Pet  friendly")) == []


def test_preserves_order_of_reordered_input(listings: list[Listing]) -> None:
    reordered = list(reversed(listings))
    result = filter_listings(reordered, SearchParams(city="Springfield"))
    assert [listing.identity for listing in result] == [
        ("MLS_B", "B8"), ("MLS_A", "A2"), ("MLS_B", "B7"), ("MLS_A", "A1")
    ]


def test_does_not_mutate_input_records_or_parameters(listings: list[Listing]) -> None:
    original_objects = list(listings)
    original_data = [listing.model_dump(mode="json") for listing in listings]
    params = SearchParams(city="Springfield", maxPrice=500000)
    original_params = params.model_dump()

    result = filter_listings(listings, params)

    assert [listing.model_dump(mode="json") for listing in listings] == original_data
    assert all(current is original for current, original in zip(listings, original_objects))
    assert result[0] is listings[0]
    assert result[1] is listings[1]
    assert params.model_dump() == original_params


def test_repeated_ids_across_sources_are_not_deduplicated(sample_record: dict[str, object]) -> None:
    records = [Listing.model_validate(sample_record),
               Listing.model_validate({**sample_record, "source": "MLS_B"})]
    result = filter_listings(records, SearchParams(city="Springfield"))
    assert [listing.identity for listing in result] == [("MLS_A", "A1"), ("MLS_B", "A1")]


def test_pending_sample_listing_is_included(listings: list[Listing]) -> None:
    result = filter_listings(listings, SearchParams(city="Chantilly"))
    assert [listing.identity for listing in result] == [("MLS_A", "A7")]
    assert result[0].status == "pending"


def test_sold_listing_is_included_when_filters_match(sample_record: dict[str, object]) -> None:
    # No supplied record is sold; change only status to cover the documented value.
    sold = Listing.model_validate({**sample_record, "status": "sold"})
    assert filter_listings([sold], SearchParams(city="Springfield", maxPrice=500000)) == [sold]


def test_target_budget_does_not_restrict_results(listings: list[Listing]) -> None:
    params = SearchParams(city="Springfield", maxPrice=500000, targetBudget=1)
    assert filter_listings(listings, params) == filter_listings(
        listings, SearchParams(city="Springfield", maxPrice=500000)
    )


def test_pagination_parameters_do_not_slice_results(listings: list[Listing]) -> None:
    assert filter_listings(listings, SearchParams(page=99, pageSize=1)) == listings


def test_accepts_tuple_without_mutating_it(listings: list[Listing]) -> None:
    records = tuple(listings)
    assert filter_listings(records, SearchParams()) == listings
    assert len(records) == 12


def test_empty_collection_returns_empty_list() -> None:
    assert filter_listings([], SearchParams(city="Springfield")) == []
