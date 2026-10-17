"""Exact public Threads posts: original caption, photos and ordered mixed media."""

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
            if item.get("code") == code and any(
                key in item for key in ("video_versions", "image_versions2", "carousel_media", "caption")
            ):
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
        code = (_post_code(url) or _post_code(response.url)
                or _post_code(self._og_search_url(webpage, default="")))
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

        description = (post.get("caption") or {}).get("text")
        if not isinstance(description, str):
            description = None
        common = {
            "id": code,
            "title": description or f"Threads post {code}",
            "description": description,
            "uploader": (post.get("user") or {}).get("username"),
            "timestamp": int_or_none(post.get("taken_at")),
        }
        carousel = post.get("carousel_media")
        if isinstance(carousel, list) and carousel:
            return {
                **common, "_type": "playlist",
                "entries": [self._media(item if isinstance(item, dict) else {}, f"{code}-{index}")
                            for index, item in enumerate(carousel, 1)],
            }
        return {**self._media(post, code), **common}

    def _media(self, media, media_id):
        formats = []
        seen = set()
        videos = media.get("video_versions") or []
        for video in videos:
            if not isinstance(video, dict):
                continue
            media_url = _media_url(video.get("url"))
            if not media_url or media_url in seen:
                continue
            seen.add(media_url)
            formats.append({
                "url": media_url,
                "format_id": f"http-{len(formats)}",
                "ext": "mp4",
                "width": int_or_none(video.get("width") or media.get("original_width")),
                "height": int_or_none(video.get("height") or media.get("original_height")),
            })
        common = {"id": media_id, "title": f"Threads media {media_id}", "formats": formats}
        if videos or media.get("media_type") == 2:
            return {**common, "post_media_type": "video"}
        thumbnails = []
        for candidate in (media.get("image_versions2") or {}).get("candidates") or []:
            if not isinstance(candidate, dict):
                continue
            media_url = _media_url(candidate.get("url"))
            if media_url:
                thumbnails.append({
                    "url": media_url,
                    "width": int_or_none(candidate.get("width")),
                    "height": int_or_none(candidate.get("height")),
                })
        thumbnails.sort(key=lambda image: (image.get("width") or 0) * (image.get("height") or 0))
        if "image_versions2" in media or media.get("media_type") == 1:
            return {**common, "post_media_type": "photo", "thumbnails": thumbnails,
                    "thumbnail": thumbnails[-1]["url"] if thumbnails else None}
        return {**common, "post_media_type": "text"}
