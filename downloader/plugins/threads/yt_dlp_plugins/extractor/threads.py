"""Public Threads video posts, using the media data embedded in the post page."""

import json
import re
from urllib.parse import urlsplit

from yt_dlp.extractor.common import InfoExtractor
from yt_dlp.utils import ExtractorError, extract_attributes, int_or_none


def _post_code(url):
    match = re.search(r"/(?:@[^/]+/post|t)/([A-Za-z0-9_-]+)(?:/|$)", urlsplit(url).path)
    return match.group(1) if match else None


def _find_post(value, code):
    pending = [value]
    while pending:
        item = pending.pop()
        if isinstance(item, dict):
            if item.get("code") == code and "video_versions" in item:
                return item
            pending.extend(item.values())
        elif isinstance(item, list):
            pending.extend(item)
    return None


def _media_url(value):
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value)
        host = (url.hostname or "").lower()
        if url.scheme == "https" and not url.username and not url.password and (
            host.endswith(".cdninstagram.com") or host.endswith(".fbcdn.net")
        ):
            return value
    except ValueError:
        pass
    return None


class ThreadsIE(InfoExtractor):
    IE_NAME = "Threads"
    _VALID_URL = r"https?://(?:www\.)?threads\.(?:com|net)/(?:@[^/?#]+/post|t|share)/(?P<id>[A-Za-z0-9_-]+)(?:[/?#]|$)"

    def _real_extract(self, url):
        link_id = self._match_id(url)
        # The anonymous desktop browser page contains video_versions. A plain
        # HTTP fingerprint can receive only the page shell, without that data.
        webpage, response = self._download_webpage_handle(url, link_id, impersonate=True)
        code = _post_code(response.url) or _post_code(self._og_search_url(webpage, default=""))
        if not code:
            raise ExtractorError("Unsupported URL: unable to resolve Threads post", expected=True)

        post = None
        for attributes, raw in re.findall(r"(?s)<script\b([^>]*)>(.*?)</script>", webpage):
            if extract_attributes(f"<script {attributes}>").get("type") != "application/json":
                continue
            if code not in raw:
                continue
            try:
                post = _find_post(json.loads(raw), code)
            except ValueError:
                continue
            if post:
                break
        if not post:
            raise ExtractorError("Threads did not return media data for this post", expected=True)

        formats = []
        seen = set()
        for video in post.get("video_versions") or []:
            media_url = _media_url(video.get("url"))
            if not media_url or media_url in seen:
                continue
            seen.add(media_url)
            formats.append({
                "url": media_url,
                "format_id": f"http-{len(formats)}",
                "ext": "mp4",
                "width": int_or_none(video.get("width") or post.get("original_width")),
                "height": int_or_none(video.get("height") or post.get("original_height")),
            })
        if not formats:
            raise ExtractorError("No video found in this post", expected=True)

        description = (post.get("caption") or {}).get("text")
        return {
            "id": code,
            "title": description or f"Threads video {code}",
            "description": description,
            "uploader": (post.get("user") or {}).get("username"),
            "timestamp": int_or_none(post.get("taken_at")),
            "formats": formats,
        }
