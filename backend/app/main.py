"""HTTP entry point: validate inputs, call services, and serialize responses."""

from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
import logging
import os
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import parse_cors_origins

from app.models import SearchParams
from app.repository import DEFAULT_DATA_PATH, ListingRepositoryError, load_listings
from app.schemas import ListingResult, SearchResponse
from app.search import search_listings


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Fail startup instead of advertising a healthy service with a missing feed.
    load_listings(get_listing_path())
    yield


app = FastAPI(title="Listing Search Service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(os.environ.get("CORS_ALLOWED_ORIGINS", "")),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=[],
)
logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    """HTTP availability after successful startup dataset validation."""

    status: str


def get_reference_date() -> date:
    """Return today's UTC date once per request; tests can override dependency."""
    return datetime.now(timezone.utc).date()


def get_listing_path() -> Path:
    """Select the project dataset; tests can substitute a temporary file."""
    return DEFAULT_DATA_PATH


@app.get("/api/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Confirm that the HTTP application is responding."""
    return HealthResponse(status="ok")


@app.get("/api/listings", response_model=SearchResponse)
def get_listings(
    params: Annotated[SearchParams, Query()],
    as_of_date: Annotated[date, Depends(get_reference_date)],
    data_path: Annotated[Path, Depends(get_listing_path)],
) -> SearchResponse:
    """Return a ranked page, with validated queries and safe dataset errors."""
    try:
        page = search_listings(params, as_of_date, data_path)
    except ListingRepositoryError as exc:
        # Keep detailed paths/validation errors in logs, never the public body.
        logger.exception("Listing dataset failed during search")
        raise HTTPException(status_code=503, detail="Listing data is unavailable.") from exc

    return SearchResponse(
        items=[ListingResult.model_validate({
            **item.listing.model_dump(), "relevanceScore": item.relevance_score,
        }) for item in page.results],
        total_count=page.total_count,
        page=page.page,
        page_size=page.page_size,
        total_pages=page.total_pages,
    )
