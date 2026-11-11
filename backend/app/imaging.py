"""Local page geometry. One image at a time, with explicit no-boundary results."""

from dataclasses import dataclass

MAX_INPUT_PIXELS = 20_000_000
MAX_OUTPUT_PIXELS = 8_000_000


class ImageError(Exception):
    pass


@dataclass
class PageImage:
    jpeg: bytes
    thumbnail: bytes
    boundary: bool
    note: str | None


def preprocess(data: bytes) -> PageImage:
    import cv2
    import numpy as np

    array = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ImageError("The image could not be read.")
    height, width = image.shape[:2]
    if height * width > MAX_INPUT_PIXELS:
        raise ImageError("The image exceeds the 20 megapixel limit.")
    boundary, warped = _warp(image)
    enhanced = _enhance(warped if boundary else image)
    enhanced = _limit(enhanced, MAX_OUTPUT_PIXELS)
    ok, encoded = cv2.imencode(".jpg", enhanced, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise ImageError("The processed image could not be saved.")
    thumb = _limit(enhanced, 320 * 320)
    thumb = _edge(thumb, 320)
    ok, thumb_encoded = cv2.imencode(".jpg", thumb, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ok:
        raise ImageError("The thumbnail could not be saved.")
    note = None if boundary else "No document boundary was detected. Contrast was enhanced without perspective correction."
    return PageImage(encoded.tobytes(), thumb_encoded.tobytes(), boundary, note)


def _warp(image):
    import cv2

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return False, image
    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) < image.shape[0] * image.shape[1] * 0.2:
        return False, image
    peri = cv2.arcLength(contour, True)
    polygon = cv2.approxPolyDP(contour, 0.02 * peri, True)
    if len(polygon) != 4:
        return False, image
    return True, _perspective(image, polygon.reshape(4, 2))


def _perspective(image, points):
    import cv2
    import numpy as np

    ordered = np.zeros((4, 2), dtype="float32")
    total = points.sum(axis=1)
    ordered[0] = points[np.argmin(total)]
    ordered[2] = points[np.argmax(total)]
    diff = np.diff(points, axis=1)
    ordered[1] = points[np.argmin(diff)]
    ordered[3] = points[np.argmax(diff)]
    width = int(max(np.linalg.norm(ordered[2] - ordered[3]), np.linalg.norm(ordered[1] - ordered[0])))
    height = int(max(np.linalg.norm(ordered[1] - ordered[2]), np.linalg.norm(ordered[0] - ordered[3])))
    if width < 20 or height < 20:
        return image
    destination = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32")
    matrix = cv2.getPerspectiveTransform(ordered, destination)
    return cv2.warpPerspective(image, matrix, (width, height))


def _enhance(image):
    import cv2

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return cv2.cvtColor(cv2.merge((clahe.apply(lightness), a, b)), cv2.COLOR_LAB2BGR)


def _limit(image, max_pixels: int):
    import cv2

    height, width = image.shape[:2]
    if height * width <= max_pixels:
        return image
    scale = (max_pixels / (height * width)) ** 0.5
    return cv2.resize(image, (max(1, int(width * scale)), max(1, int(height * scale))))


def valid_region(region) -> bool:
    if not isinstance(region, (list, tuple)) or len(region) != 4:
        return False
    try:
        x, y, width, height = (float(item) for item in region)
    except (TypeError, ValueError):
        return False
    if any(item != item for item in (x, y, width, height)):
        return False
    if width <= 0 or height <= 0 or x < -0.001 or y < -0.001:
        return False
    if x + width > 1.001 or y + height > 1.001:
        return False
    return True


def content_regions(jpeg: bytes) -> list[tuple[float, float, float, float]]:
    """Normalized content boxes on one stored page. The full page is the fallback."""
    import cv2
    import numpy as np

    image = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ImageError("The page image could not be read.")
    height, width = image.shape[:2]
    if height * width > MAX_INPUT_PIXELS:
        raise ImageError("The page image exceeds the 20 megapixel limit.")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 120)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes: list[tuple[float, float, float, float]] = []
    page_area = float(height * width)
    for contour in contours:
        left, top, box_width, box_height = cv2.boundingRect(contour)
        if box_width < 16 or box_height < 16:
            continue
        area = box_width * box_height
        if area < page_area * 0.02 or area > page_area * 0.85:
            continue
        region = _clamp_region(left / width, top / height, box_width / width, box_height / height)
        if region is not None:
            boxes.append(region)
    merged = _merge_regions(boxes)[:4]
    return merged or [(0.0, 0.0, 1.0, 1.0)]


def crop_jpeg(jpeg: bytes, region) -> bytes:
    import cv2
    import numpy as np

    if not valid_region(region):
        raise ImageError("The stored region is not a normalized box.")
    image = cv2.imdecode(np.frombuffer(jpeg, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ImageError("The page image could not be read.")
    height, width = image.shape[:2]
    x, y, box_width, box_height = (float(item) for item in region)
    left = max(0, min(width - 1, int(round(x * width))))
    top = max(0, min(height - 1, int(round(y * height))))
    right = max(left + 1, min(width, int(round((x + box_width) * width))))
    bottom = max(top + 1, min(height, int(round((y + box_height) * height))))
    crop = _limit(image[top:bottom, left:right], 1_000_000)
    ok, encoded = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ok:
        raise ImageError("The page region could not be prepared.")
    return encoded.tobytes()


def query_jpeg(data: bytes) -> bytes:
    """Validate a query image and return one limited JPEG. Does not call a provider."""
    import cv2
    import numpy as np

    from app.extract import detect_media

    if len(data) > 25 * 1024 * 1024:
        raise ImageError("The query image exceeds the upload limit.")
    media = detect_media(data, "query.png")
    if media not in {"image/png", "image/jpeg", "image/webp"}:
        raise ImageError("The query image must be PNG, JPEG, or WebP.")
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ImageError("The query image could not be read.")
    height, width = image.shape[:2]
    if height * width > MAX_INPUT_PIXELS:
        raise ImageError("The query image exceeds the 20 megapixel limit.")
    limited = _limit(image, 1_000_000)
    ok, encoded = cv2.imencode(".jpg", limited, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    if not ok:
        raise ImageError("The query image could not be prepared.")
    return encoded.tobytes()


def _clamp_region(x: float, y: float, width: float, height: float):
    x = min(1.0, max(0.0, x))
    y = min(1.0, max(0.0, y))
    width = min(1.0 - x, max(0.0, width))
    height = min(1.0 - y, max(0.0, height))
    if width < 0.01 or height < 0.01:
        return None
    return (round(x, 6), round(y, 6), round(width, 6), round(height, 6))


def _merge_regions(boxes: list[tuple[float, float, float, float]]):
    kept: list[tuple[float, float, float, float]] = []
    for box in sorted(boxes, key=lambda item: item[2] * item[3], reverse=True):
        if any(_iou(box, other) > 0.5 for other in kept):
            continue
        kept.append(box)
    return kept


def _iou(left, right) -> float:
    ax, ay, aw, ah = left
    bx, by, bw, bh = right
    ix = max(0.0, min(ax + aw, bx + bw) - max(ax, bx))
    iy = max(0.0, min(ay + ah, by + bh) - max(ay, by))
    intersection = ix * iy
    union = aw * ah + bw * bh - intersection
    if union <= 0:
        return 0.0
    return intersection / union


def _edge(image, edge: int):
    import cv2

    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= edge:
        return image
    scale = edge / longest
    return cv2.resize(image, (max(1, int(width * scale)), max(1, int(height * scale))))
