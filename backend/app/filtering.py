"""Pure listing filtering, separate from loading, ranking, and pagination."""

from collections.abc import Sequence

from app.models import Listing, SearchParams


def filter_listings(listings: Sequence[Listing], params: SearchParams) -> list[Listing]:
    """Return records that satisfy every supplied filter, in input order.

    Args:
        listings: Ordered, validated records; neither records nor input are mutated.
        params: Validated inputs. Blank text normalization belongs to SearchParams.

    Returns:
        A new list containing the original matching objects, without merging
        records. Budget, status, and pagination do not restrict this stage.
    """
    city = params.city.casefold() if params.city is not None else None
    keyword = params.keyword.casefold() if params.keyword is not None else None
    matches = []

    for listing in listings:
        # Reject on the first failed condition: all supplied filters must match.
        if params.min_price is not None and listing.price < params.min_price:
            continue
        if params.max_price is not None and listing.price > params.max_price:
            continue
        if params.min_bedrooms is not None and listing.bedrooms < params.min_bedrooms:
            continue
        if city is not None and listing.city.strip().casefold() != city:
            continue
        if keyword is not None and keyword not in listing.description.casefold():
            continue
        matches.append(listing)

    return matches
