"""Validated feed records and search inputs, independent of HTTP handlers."""

from datetime import date
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Listing(BaseModel):
    """One feed record; aliases preserve the supplied JSON field names.

    Feed data uses strict types so malformed records are not silently coerced.
    Dates are parsed explicitly, while numeric JSON integers may represent floats.
    """

    model_config = ConfigDict(
        strict=True, allow_inf_nan=False, serialize_by_alias=True, validate_by_name=True
    )

    id: str
    source: str
    address: str
    city: str
    state: str
    zip: str
    price: float = Field(ge=0)
    bedrooms: int = Field(ge=0)
    bathrooms: float = Field(ge=0)
    sqft: int = Field(ge=0)
    latitude: float
    longitude: float
    listed_date: date = Field(alias="listedDate")
    status: Literal["active", "pending", "sold"]
    description: str

    @field_validator("listed_date", mode="before")
    @classmethod
    def parse_listed_date(cls, value: object) -> date:
        """Accept a date or its YYYY-MM-DD representation; reject timestamps."""
        if type(value) is date:
            return value
        if isinstance(value, str):
            try:
                parsed = date.fromisoformat(value)
            except ValueError:
                pass
            else:
                if parsed.isoformat() == value:
                    return parsed
        raise ValueError("listedDate must be a valid ISO date (YYYY-MM-DD)")

    @property
    def identity(self) -> tuple[str, str]:
        """Return (source, id); an ID alone is not unique across MLS feeds."""
        return self.source, self.id


class SearchParams(BaseModel):
    """Search inputs only; constructing this model does not execute a search.

    Numeric strings are accepted for future URL query parameters. Pagination
    defaults are implementation choices, with no arbitrary upper size limit.
    """

    model_config = ConfigDict(
        allow_inf_nan=False, serialize_by_alias=True, validate_by_name=True
    )

    min_price: float | None = Field(default=None, alias="minPrice", ge=0)
    max_price: float | None = Field(default=None, alias="maxPrice", ge=0)
    min_bedrooms: int | None = Field(default=None, alias="minBedrooms", ge=0)
    city: str | None = None
    keyword: str | None = None
    target_budget: float | None = Field(default=None, alias="targetBudget", gt=0)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=10, alias="pageSize", ge=1)

    @field_validator(
        "min_price", "max_price", "min_bedrooms", "target_budget", "page", "page_size",
        mode="before",
    )
    @classmethod
    def reject_boolean_numbers(cls, value: object) -> object:
        """Reject booleans rather than interpreting True/False as 1/0."""
        if isinstance(value, bool):
            raise ValueError("must be a number, not a boolean")
        return value

    @field_validator("city", "keyword")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        """Trim surrounding whitespace; blank text means no filter.

        Preserve case and internal spacing so matching semantics remain a
        separate decision for the future filtering implementation.
        """
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def validate_price_range(self) -> Self:
        """Reject inverted ranges only when both price bounds are supplied."""
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            raise ValueError("minPrice must be less than or equal to maxPrice")
        return self
