from datetime import date

import pytest
from pydantic import ValidationError

from app.models import Listing, SearchParams


def test_listing_preserves_external_fields_and_parses_date(sample_record: dict[str, object]) -> None:
    listing = Listing.model_validate(sample_record)

    assert listing.identity == ("MLS_A", "A1")
    assert listing.listed_date == date(2026, 8, 29)
    assert listing.bathrooms == 1.5
    assert listing.zip == "22150"
    assert listing.model_dump(mode="json") == sample_record


@pytest.mark.parametrize("status", ["active", "pending", "sold"])
def test_listing_accepts_documented_statuses(sample_record: dict[str, object], status: str) -> None:
    assert Listing.model_validate({**sample_record, "status": status}).status == status


@pytest.mark.parametrize("field", list(Listing.model_fields))
def test_listing_requires_every_field(sample_record: dict[str, object], field: str) -> None:
    external_field = Listing.model_fields[field].alias or field
    del sample_record[external_field]
    with pytest.raises(ValidationError) as error:
        Listing.model_validate(sample_record)
    assert error.value.errors()[0]["loc"] == (external_field,)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("price", -1), ("price", "450000"), ("price", True),
        ("price", float("inf")), ("bedrooms", -1), ("bedrooms", 2.5),
        ("bedrooms", True), ("bathrooms", -0.5), ("sqft", -1),
        ("sqft", 980.5), ("latitude", float("nan")), ("longitude", "west"),
        ("zip", 22150), ("id", None), ("source", 7),
        ("status", "withdrawn"), ("listedDate", "2026-02-30"),
        ("listedDate", "20260829"), ("listedDate", "2026-08-29T00:00:00"),
        ("listedDate", 1787961600),
    ],
)
def test_listing_rejects_invalid_fields(sample_record: dict[str, object], field: str, value: object) -> None:
    with pytest.raises(ValidationError) as error:
        Listing.model_validate({**sample_record, field: value})
    assert error.value.errors()[0]["loc"] == (field,)


def test_search_accepts_valid_parameters_and_external_names() -> None:
    params = SearchParams.model_validate({
        "minPrice": "400000", "maxPrice": 600000, "minBedrooms": "2",
        "city": "  Springfield \t", "keyword": "  Pet friendly  ",
        "targetBudget": "450000", "page": "2", "pageSize": "5",
    })
    assert params.model_dump() == {
        "minPrice": 400000.0, "maxPrice": 600000.0, "minBedrooms": 2,
        "city": "Springfield", "keyword": "Pet friendly",
        "targetBudget": 450000.0, "page": 2, "pageSize": 5,
    }


def test_omitted_search_filters_are_none_with_pagination_defaults() -> None:
    params = SearchParams()
    assert params.page == 1
    assert params.page_size == 10
    assert all(value is None for key, value in params.model_dump().items()
               if key not in {"page", "pageSize"})


@pytest.mark.parametrize("field", ["minPrice", "maxPrice", "minBedrooms", "city", "keyword", "targetBudget"])
def test_optional_search_filters_accept_explicit_none(field: str) -> None:
    assert SearchParams.model_validate({field: None}).model_dump()[field] is None


@pytest.mark.parametrize("text", ["", "  ", "\n\t"])
def test_blank_text_filters_mean_no_filter(text: str) -> None:
    params = SearchParams(city=text, keyword=text)
    assert params.city is None
    assert params.keyword is None


def test_text_normalization_preserves_case_and_internal_spacing() -> None:
    params = SearchParams(keyword="  Pet  friendly  ")
    assert params.keyword == "Pet  friendly"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("minPrice", -1), ("maxPrice", -1), ("minBedrooms", -1),
        ("minBedrooms", 1.5), ("minBedrooms", "two"),
        ("targetBudget", 0), ("targetBudget", -1),
        ("page", 0), ("page", -1), ("page", 1.5), ("page", None),
        ("pageSize", 0), ("pageSize", -1), ("pageSize", 1.5), ("pageSize", None),
        ("minPrice", float("nan")), ("maxPrice", float("inf")),
        ("targetBudget", float("inf")), ("city", 42), ("keyword", []),
    ] + [(field, True) for field in ["minPrice", "maxPrice", "minBedrooms", "targetBudget", "page", "pageSize"]],
)
def test_search_rejects_invalid_values_with_field_errors(field: str, value: object) -> None:
    with pytest.raises(ValidationError) as error:
        SearchParams.model_validate({field: value})
    assert error.value.errors()[0]["loc"] == (field,)


def test_search_rejects_inverted_price_range() -> None:
    with pytest.raises(ValidationError, match="minPrice must be less than or equal to maxPrice"):
        SearchParams(minPrice=500000, maxPrice=400000)


@pytest.mark.parametrize("values", [
    {"minPrice": 0, "maxPrice": 0, "minBedrooms": 0},
    {"minPrice": 500000}, {"maxPrice": 0},
    {"targetBudget": 0.01}, {"page": 1, "pageSize": 100000},
])
def test_search_accepts_boundaries_and_independent_optional_limits(values: dict[str, object]) -> None:
    # Zero is a valid filter bound; a positive budget and page size have no invented cap.
    SearchParams.model_validate(values)
