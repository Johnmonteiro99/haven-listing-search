"""Explicit browser origins; missing configuration keeps cross-origin access closed."""

from urllib.parse import urlsplit


def parse_cors_origins(value: str) -> list[str]:
    origins: list[str] = []
    for entry in value.split(","):
        origin = entry.strip().rstrip("/")
        if not origin:
            continue
        try:
            url = urlsplit(origin)
            port = url.port
        except ValueError as exc:
            raise ValueError("CORS_ALLOWED_ORIGINS contains an invalid origin") from exc
        local = url.hostname in {"localhost", "127.0.0.1", "::1"}
        if (url.scheme not in {"http", "https"} or not url.hostname
                or "*" in origin or any(character.isspace() for character in origin)
                or url.username or url.password or url.path
                or url.query or url.fragment or (url.scheme == "http" and not local)
                or (port is not None and port < 1)):
            raise ValueError("CORS_ALLOWED_ORIGINS requires explicit HTTPS origins (HTTP loopback is allowed locally)")
        if origin not in origins:
            origins.append(origin)
    return origins
