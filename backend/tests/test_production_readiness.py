"""Deployment contracts: fail closed CORS and dataset validation before serving."""

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

import app.main as main
from app.config import parse_cors_origins
from app.repository import ListingRepositoryError


def test_cors_origins_normalize_and_deduplicate():
    assert parse_cors_origins("") == []
    assert parse_cors_origins(" https://haven.example.com/,https://haven.example.com,http://127.0.0.1:5173 ") == [
        "https://haven.example.com", "http://127.0.0.1:5173"]


@pytest.mark.parametrize("origin", ["*", "https://*.vercel.app", "null", "http://public.example.com",
    "https://example.com/path", "https://user:pass@example.com", "https://example.com?token=x",
    "https://example.com#fragment", "https://example.com:invalid", "https://invalid host.example", "https://[invalid"])
def test_cors_rejects_invalid_origins(origin):
    with pytest.raises(ValueError):
        parse_cors_origins(origin)


def test_cors_allows_only_explicit_get_origin_without_credentials():
    # Wrap the actual app so HTTP contracts and configured middleware are exercised together.
    app = CORSMiddleware(main.app, allow_origins=parse_cors_origins("https://haven.example.com"),
                         allow_methods=["GET"], allow_credentials=False, allow_headers=[])
    with TestClient(app) as client:
        allowed = client.get("/api/listings", headers={"Origin": "https://haven.example.com"})
        assert allowed.status_code == 200
        assert allowed.headers["access-control-allow-origin"] == "https://haven.example.com"
        assert "access-control-allow-credentials" not in allowed.headers
        denied = client.get("/api/health", headers={"Origin": "https://unapproved.example.com"})
        assert "access-control-allow-origin" not in denied.headers
        preflight = client.options("/api/listings", headers={"Origin": "https://haven.example.com",
            "Access-Control-Request-Method": "GET"})
        assert preflight.status_code == 200
        denied_method = client.options("/api/listings", headers={"Origin": "https://haven.example.com",
            "Access-Control-Request-Method": "POST"})
        assert denied_method.status_code == 400
        assert client.get("/api/health").json() == {"status": "ok"}


@pytest.mark.parametrize("contents", [None, "invalid json", '[{"id":"incomplete"}]'])
def test_startup_rejects_missing_malformed_or_invalid_dataset(tmp_path, monkeypatch, contents):
    path = tmp_path / "listings.json"
    if contents is not None:
        path.write_text(contents)
    monkeypatch.setattr(main, "DEFAULT_DATA_PATH", path)
    with pytest.raises(ListingRepositoryError):
        with TestClient(main.app):
            pass
