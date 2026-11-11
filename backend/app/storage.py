"""Private object storage. Tests and local runs use the filesystem. R2 is used only when configured."""

import hashlib
import hmac
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote

from app.config import Settings
from app.security import utcnow


class StorageError(Exception):
    pass


def _b64(value: bytes) -> str:
    return urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _unb64(value: str) -> bytes:
    return urlsafe_b64decode(value + "=" * (-len(value) % 4))


class LocalStore:
    def __init__(self, root: Path, signing_key: str):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.signing_key = signing_key.encode("utf-8")

    def put(self, key: str, data: bytes, media_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        path.with_suffix(path.suffix + ".type").write_text(media_type, encoding="utf-8")

    def get(self, key: str) -> tuple[bytes, str]:
        path = self._path(key)
        if not path.is_file():
            raise StorageError("missing")
        media = "application/octet-stream"
        marker = path.with_suffix(path.suffix + ".type")
        if marker.is_file():
            media = marker.read_text(encoding="utf-8")
        return path.read_bytes(), media

    def size(self, key: str) -> int:
        path = self._path(key)
        return path.stat().st_size if path.is_file() else 0

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink()
        marker = path.with_suffix(path.suffix + ".type")
        if marker.is_file():
            marker.unlink()

    def signed_url(self, key: str, name: str, media_type: str, expires_in: int = 60) -> str:
        exp = int((utcnow() + timedelta(seconds=expires_in)).timestamp())
        payload = f"{key}\n{exp}\n{media_type}\n{name}".encode("utf-8")
        sig = hmac.new(self.signing_key, payload, hashlib.sha256).digest()
        token = f"{_b64(payload)}.{_b64(sig)}"
        return f"/api/v1/files/{token}"

    def read_token(self, token: str) -> tuple[str, str, str]:
        try:
            payload_b64, sig_b64 = token.split(".", 1)
            payload = _unb64(payload_b64)
            expected = hmac.new(self.signing_key, payload, hashlib.sha256).digest()
            if not hmac.compare_digest(expected, _unb64(sig_b64)):
                raise StorageError("signature")
            key, exp, media_type, name = payload.decode("utf-8").split("\n", 3)
            if int(exp) < int(datetime.now(timezone.utc).timestamp()):
                raise StorageError("expired")
        except StorageError:
            raise
        except Exception as exc:
            raise StorageError("signature") from exc
        return key, media_type, name

    def _path(self, key: str) -> Path:
        if not key or ".." in key.split("/") or key.startswith("/"):
            raise StorageError("key")
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents and path != self.root.resolve():
            raise StorageError("key")
        return path


def _sign(key: bytes, message: str) -> bytes:
    return hmac.new(key, message.encode("utf-8"), hashlib.sha256).digest()


def presign_r2_get(settings: Settings, object_key: str, expires_in: int = 60) -> str:
    """Build a 60-second R2 GET URL. This does not contact Cloudflare."""
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    datestamp = now.strftime("%Y%m%d")
    host = f"{settings.r2_account_id}.r2.cloudflarestorage.com"
    canonical_uri = "/" + "/".join(quote(part, safe="") for part in (settings.r2_bucket, object_key))
    credential = f"{settings.r2_access_key_id}/{datestamp}/auto/s3/aws4_request"
    params = {
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": credential,
        "X-Amz-Date": amz_date,
        "X-Amz-Expires": str(expires_in),
        "X-Amz-SignedHeaders": "host",
    }
    canonical_query = "&".join(f"{quote(k, safe='')}={quote(params[k], safe='')}" for k in sorted(params))
    canonical = "\n".join(("GET", canonical_uri, canonical_query, f"host:{host}\n", "host", "UNSIGNED-PAYLOAD"))
    scope = f"{datestamp}/auto/s3/aws4_request"
    to_sign = "\n".join(("AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()))
    secret = settings.r2_secret_access_key or ""
    signing = _sign(_sign(_sign(_sign(("AWS4" + secret).encode(), datestamp), "auto"), "s3"), "aws4_request")
    signature = hmac.new(signing, to_sign.encode(), hashlib.sha256).hexdigest()
    return f"https://{host}{canonical_uri}?{canonical_query}&X-Amz-Signature={signature}"


class R2Store:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._sizes: dict[str, int] = {}

    def put(self, key: str, data: bytes, media_type: str) -> None:
        import httpx

        now = datetime.now(timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        host = f"{self.settings.r2_account_id}.r2.cloudflarestorage.com"
        canonical_uri = "/" + "/".join(quote(part, safe="") for part in (self.settings.r2_bucket, key))
        payload_hash = hashlib.sha256(data).hexdigest()
        signed = {
            "content-type": media_type,
            "host": host,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
        }
        authorization = _authorization("PUT", canonical_uri, signed, payload_hash, self.settings, amz_date)
        response = httpx.put(
            f"https://{host}{canonical_uri}",
            content=data,
            headers={
                "Content-Type": media_type,
                "Host": host,
                "x-amz-content-sha256": payload_hash,
                "x-amz-date": amz_date,
                "Authorization": authorization,
            },
            timeout=20,
        )
        if response.status_code >= 300:
            raise StorageError("upload failed")
        self._sizes[key] = len(data)

    def get(self, key: str) -> tuple[bytes, str]:
        raise StorageError("reads use signed URLs")

    def size(self, key: str) -> int:
        return self._sizes.get(key, 0)

    def delete(self, key: str) -> None:
        self._sizes.pop(key, None)

    def read_token(self, token: str) -> tuple[str, str, str]:
        raise StorageError("signature")

    def signed_url(self, key: str, name: str, media_type: str, expires_in: int = 60) -> str:
        return presign_r2_get(self.settings, key, expires_in)


def _authorization(method: str, canonical_uri: str, headers: dict[str, str], payload_hash: str, settings: Settings, amz_date: str) -> str:
    datestamp = amz_date[:8]
    names = sorted(headers)
    canonical_headers = "".join(f"{name}:{headers[name]}\n" for name in names)
    signed_headers = ";".join(names)
    canonical = "\n".join((method, canonical_uri, "", canonical_headers, signed_headers, payload_hash))
    scope = f"{datestamp}/auto/s3/aws4_request"
    to_sign = "\n".join(("AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical.encode()).hexdigest()))
    key = ("AWS4" + (settings.r2_secret_access_key or "")).encode()
    for part in (datestamp, "auto", "s3", "aws4_request"):
        key = hmac.new(key, part.encode(), hashlib.sha256).digest()
    signature = hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()
    credential = f"{settings.r2_access_key_id}/{scope}"
    return f"AWS4-HMAC-SHA256 Credential={credential}, SignedHeaders={signed_headers}, Signature={signature}"


def build_store(settings: Settings):
    if settings.r2_ready:
        return R2Store(settings)
    return LocalStore(Path(settings.object_dir), settings.file_signing_key)
