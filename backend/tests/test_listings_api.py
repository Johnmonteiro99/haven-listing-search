"""Actual HTTP contracts with fixed dates and isolated dependency overrides."""

from collections.abc import Iterator
from datetime import date
import json
import logging
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from app.main import app, get_listing_path, get_reference_date

AS_OF_DATE = date(2026, 9, 28)


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Keep dependency overrides local to each test, including failing tests."""
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_reference_date] = lambda: AS_OF_DATE
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_default_search_has_ten_items_and_all_twelve_in_totals(client: TestClient) -> None:
    response = client.get('/api/listings')
    assert response.status_code == 200
    data = response.json()
    assert len(data['items']) == 10
    assert {key: value for key, value in data.items() if key != 'items'} == {
        'totalCount': 12, 'page': 1, 'pageSize': 10, 'totalPages': 2,
    }
    assert data['items'][0]['id'] == 'A5'  # Newest listing when budget is absent.


def test_unfiltered_search_can_return_all_records_in_ranked_order(client: TestClient) -> None:
    response = client.get('/api/listings', params={'pageSize': 12})
    data = response.json()
    assert response.status_code == 200
    assert [item['id'] for item in data['items']] == [
        'A5', 'A4', 'A2', 'A3', 'B8', 'A1', 'B7', 'B9', 'B10', 'B11', 'A6', 'A7',
    ]
    assert (data['totalCount'], data['totalPages']) == (12, 1)
    assert next(item for item in data['items'] if item['id'] == 'A7')['status'] == 'pending'


@pytest.mark.parametrize(('query', 'expected_ids'), [
    ({'minPrice': 600000}, ['A4']),
    ({'maxPrice': 400000}, ['A3', 'B9']),
    ({'minBedrooms': 4}, ['A4', 'A7']),
    ({'city': '  sPrInGfIeLd '}, ['A2', 'B8', 'A1', 'B7']),
    ({'keyword': 'ITCHEN'}, ['A2', 'B8']),
    ({'city': ' ', 'keyword': '\t', 'pageSize': 12},
     ['A5', 'A4', 'A2', 'A3', 'B8', 'A1', 'B7', 'B9', 'B10', 'B11', 'A6', 'A7']),
])
def test_query_filters_are_applied_through_real_pipeline(
    client: TestClient, query: dict[str, object], expected_ids: list[str]
) -> None:
    response = client.get('/api/listings', params=query)
    assert response.status_code == 200
    data = response.json()
    assert [item['id'] for item in data['items']] == expected_ids
    assert data['totalCount'] == len(expected_ids)


def test_combined_query_preserves_cross_feed_identity_and_full_precision(client: TestClient) -> None:
    response = client.get('/api/listings', params={
        'city': 'Springfield', 'maxPrice': 500000, 'minBedrooms': 2,
        'keyword': 'top', 'targetBudget': 500000,
    })
    assert response.status_code == 200
    data = response.json()
    assert [(item['source'], item['id']) for item in data['items']] == [('MLS_A', 'A1'), ('MLS_B', 'B7')]
    assert data['items'][0]['relevanceScore'] == pytest.approx(88)
    assert data['items'][1]['relevanceScore'] == pytest.approx(87.94666666666667, abs=1e-12)
    assert data['items'][1]['relevanceScore'] != round(data['items'][1]['relevanceScore'], 2)


def test_budget_changes_ranking_without_filtering_results(client: TestClient) -> None:
    data = client.get('/api/listings', params={'targetBudget': 500000, 'pageSize': 12}).json()
    assert [item['id'] for item in data['items']] == [
        'A2', 'A5', 'B8', 'A1', 'B7', 'B11', 'A7', 'B10', 'A3', 'A4', 'B9', 'A6',
    ]
    assert data['totalCount'] == 12


def test_multiple_pages_cover_all_ranked_results(client: TestClient) -> None:
    pages = [client.get('/api/listings', params={'targetBudget': 500000, 'pageSize': 5, 'page': page}).json()
             for page in [1, 2, 3]]
    assert [len(data['items']) for data in pages] == [5, 5, 2]
    assert all((data['totalCount'], data['totalPages']) == (12, 3) for data in pages)
    combined = [item['id'] for data in pages for item in data['items']]
    assert combined == ['A2', 'A5', 'B8', 'A1', 'B7', 'B11', 'A7', 'B10', 'A3', 'A4', 'B9', 'A6']


def test_out_of_range_page_is_successful_and_preserves_metadata(client: TestClient) -> None:
    response = client.get('/api/listings', params={'city': 'Springfield', 'page': 99, 'pageSize': 2})
    assert response.status_code == 200
    assert response.json() == {'items': [], 'totalCount': 4, 'page': 99, 'pageSize': 2, 'totalPages': 2}


def test_no_matches_is_successful_empty_response(client: TestClient) -> None:
    response = client.get('/api/listings', params={'city': 'Unknown', 'page': 3})
    assert response.status_code == 200
    assert response.json() == {'items': [], 'totalCount': 0, 'page': 3, 'pageSize': 10, 'totalPages': 0}


def test_public_field_names_and_json_types(client: TestClient, sample_record: dict[str, object]) -> None:
    data = client.get('/api/listings', params={'minPrice': 450000, 'maxPrice': 450000}).json()
    item = data['items'][0]
    assert set(item) == set(sample_record) | {'relevanceScore'}
    assert item['listedDate'] == '2026-08-29'
    assert item['zip'] == '22150'
    assert isinstance(item['price'], (int, float))
    assert isinstance(item['relevanceScore'], (int, float))
    assert isinstance(item['bedrooms'], int)
    assert isinstance(item['bathrooms'], (int, float))
    assert set(data) == {'items', 'totalCount', 'page', 'pageSize', 'totalPages'}
    assert all(isinstance(data[key], int) for key in ['totalCount', 'page', 'pageSize', 'totalPages'])


@pytest.mark.parametrize('query', [
    {'minPrice': -1}, {'maxPrice': -1}, {'minPrice': 500000, 'maxPrice': 400000},
    {'minBedrooms': -1}, {'minBedrooms': 2.5}, {'targetBudget': 0}, {'targetBudget': -1},
    {'page': 0}, {'pageSize': 0}, {'minPrice': 'oops'}, {'maxPrice': 'oops'},
    {'minBedrooms': 'oops'}, {'targetBudget': 'oops'}, {'page': 'oops'}, {'pageSize': 'oops'},
    {'targetBudget': 'nan'}, {'maxPrice': 'inf'},
])
def test_invalid_query_is_standard_422(client: TestClient, query: dict[str, object]) -> None:
    response = client.get('/api/listings', params=query)
    assert response.status_code == 422
    errors = response.json()['detail']
    assert errors and all(error['loc'][0] == 'query' for error in errors)
    assert all(error['msg'] and error['type'] for error in errors)


def test_range_error_names_both_bounds(client: TestClient) -> None:
    response = client.get('/api/listings', params={'minPrice': 10, 'maxPrice': 1})
    assert response.status_code == 422
    assert 'minPrice must be less than or equal to maxPrice' in response.json()['detail'][0]['msg']


def test_sold_record_is_returned_without_deduplication(
    client: TestClient, tmp_path: Path, sample_record: dict[str, object]
) -> None:
    path = tmp_path / 'sold.json'
    path.write_text(json.dumps([sample_record, {**sample_record, 'source': 'MLS_B', 'status': 'sold'}]))
    app.dependency_overrides[get_listing_path] = lambda: path
    data = client.get('/api/listings').json()
    assert [(item['source'], item['id'], item['status']) for item in data['items']] == [
        ('MLS_A', 'A1', 'active'), ('MLS_B', 'A1', 'sold'),
    ]


@pytest.mark.parametrize('failure', ['missing', 'malformed', 'invalid'])
def test_repository_failures_return_safe_503_and_keep_internal_details(
    client: TestClient, tmp_path: Path, failure: str, caplog: pytest.LogCaptureFixture
) -> None:
    path = tmp_path / 'private-dataset.json'
    if failure == 'malformed':
        path.write_text('[{')
    elif failure == 'invalid':
        path.write_text('[{"id":"broken"}]')
    app.dependency_overrides[get_listing_path] = lambda: path
    with caplog.at_level(logging.ERROR, logger='app.main'):
        response = client.get('/api/listings')
    assert response.status_code == 503
    assert response.json() == {'detail': 'Listing data is unavailable.'}
    assert str(path) not in response.text
    assert str(path) in caplog.text


def test_reference_date_dependency_is_called_once_per_request(client: TestClient) -> None:
    calls = []
    def fixed_date() -> date:
        calls.append(True)
        return AS_OF_DATE
    app.dependency_overrides[get_reference_date] = fixed_date
    first = client.get('/api/listings', params={'targetBudget': 500000}).json()
    second = client.get('/api/listings', params={'targetBudget': 500000}).json()
    assert len(calls) == 2
    assert first == second


def test_openapi_documents_camel_case_queries_and_response(client: TestClient) -> None:
    schema = client.get('/openapi.json').json()
    operation = schema['paths']['/api/listings']['get']
    assert {param['name'] for param in operation['parameters']} == {
        'minPrice', 'maxPrice', 'minBedrooms', 'city', 'keyword', 'targetBudget', 'page', 'pageSize',
    }
    assert operation['responses']['200']['content']['application/json']['schema']['$ref'].endswith('/SearchResponse')
