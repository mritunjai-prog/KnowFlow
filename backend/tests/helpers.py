import json
import re
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parents[2]
OPENAPI = json.loads((ROOT / "docs" / "openapi.json").read_text())
SCHEMAS = OPENAPI["components"]["schemas"]
TOKEN_RE = re.compile(r"KNOWFLOW_EMAIL_VERIFICATION purpose=(?P<purpose>\S+) email=(?P<email>\S+) token=(?P<token>\S+)")


def resolve(schema):
    if isinstance(schema, dict):
        if "$ref" in schema:
            name = schema["$ref"].rsplit("/", 1)[-1]
            return resolve(SCHEMAS[name])
        return {key: resolve(value) for key, value in schema.items()}
    if isinstance(schema, list):
        return [resolve(item) for item in schema]
    return schema


def assert_schema(instance, name: str) -> None:
    jsonschema.validate(instance, resolve(SCHEMAS[name]))


def bootstrap(client) -> str:
    response = client.get("/api/v1/session")
    assert response.status_code == 200, response.text
    body = response.json()
    assert_schema(body, "Session")
    client.headers["X-CSRF-Token"] = body["csrfToken"]
    return body["csrfToken"]


def verification_token(caplog, purpose: str, email: str) -> str:
    captured = list(caplog.messages) + [record.getMessage() for record in caplog.get_records("call")]
    matches = [
        match
        for message in captured
        if (match := TOKEN_RE.search(message)) and match.group("purpose") == purpose and match.group("email") == email
    ]
    assert matches, captured
    return matches[-1].group("token")


def register_and_verify(client, caplog, email="ada@example.com", password="correct-horse-1", name="Ada Lovelace"):
    bootstrap(client)
    with caplog.at_level("INFO", logger="knowflow.verification"):
        created = client.post("/api/v1/auth/register", json={"name": name, "email": email, "password": password})
    assert created.status_code == 201, created.text
    assert_schema(created.json(), "Session")
    assert created.json()["user"] is None
    assert password not in created.text
    token = verification_token(caplog, "registration", email)
    bootstrap(client)
    confirmed = client.post("/api/v1/auth/email-verifications/confirm", json={"token": token, "password": password})
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["user"] is None
    return token
