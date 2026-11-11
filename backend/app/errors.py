from fastapi import Request
from fastapi.responses import JSONResponse


def error_body(code: str, message: str, request: Request, fields: dict[str, str] | None = None) -> dict:
    error: dict = {"code": code, "message": message, "requestId": getattr(request.state, "request_id", None)}
    if not error["requestId"]:
        error.pop("requestId")
    if fields:
        error["fields"] = fields
    return {"error": error}


def error_response(
    status: int,
    code: str,
    message: str,
    request: Request,
    fields: dict[str, str] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    response = JSONResponse(error_body(code, message, request, fields), status_code=status)
    if headers:
        for key, value in headers.items():
            response.headers[key] = value
    return response
