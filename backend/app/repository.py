"""Read local listing data without coupling file I/O to search or HTTP logic."""

import json
from pathlib import Path

from pydantic import ValidationError

from app.models import Listing

# Anchor to the source file, not the directory from which Python was launched.
DEFAULT_DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "sample_listings.json"


class ListingRepositoryError(Exception):
    """The dataset could not be read or validated; the original error is chained."""


def load_listings(path: Path = DEFAULT_DATA_PATH) -> list[Listing]:
    """Load every record in file order, returning validated listing models.

    Args:
        path: Dataset location; tests can supply temporary files.

    Raises:
        ListingRepositoryError: File access, encoding, JSON shape, or record
            validation failed. Invalid records are never silently skipped.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise ListingRepositoryError(f"Cannot read listing file {path}: {exc}") from exc

    try:
        records = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ListingRepositoryError(f"Malformed JSON in {path}: {exc}") from exc

    if not isinstance(records, list):
        raise ListingRepositoryError(f"Listing file {path} must contain a JSON array")

    listings = []
    for index, record in enumerate(records):
        try:
            listings.append(Listing.model_validate(record))
        except ValidationError as exc:
            # Include the zero-based record index and Pydantic's field details.
            raise ListingRepositoryError(
                f"Invalid listing at index {index} in {path}: {exc}"
            ) from exc
    return listings
