"""Public search response models; internal algorithms retain their dataclasses."""

from pydantic import BaseModel, ConfigDict, Field

from app.models import Listing


class ListingResult(Listing):
    """All external feed fields plus an unrounded numerical relevance score."""

    relevance_score: float = Field(alias="relevanceScore", ge=0, le=100)


class SearchResponse(BaseModel):
    """CamelCase response contract for the requested ranked page."""

    model_config = ConfigDict(serialize_by_alias=True, validate_by_name=True)

    items: list[ListingResult]
    total_count: int = Field(alias="totalCount")
    page: int
    page_size: int = Field(alias="pageSize")
    total_pages: int = Field(alias="totalPages")
