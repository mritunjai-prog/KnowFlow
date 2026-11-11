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


def _edge(image, edge: int):
    import cv2

    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= edge:
        return image
    scale = edge / longest
    return cv2.resize(image, (max(1, int(width * scale)), max(1, int(height * scale))))
