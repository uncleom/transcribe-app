# /// script
# requires-python = ">=3.11"
# dependencies = ["yt-dlp==2026.8.19"]
# ///
import json
import sys
import subprocess
import unittest
from pathlib import Path
from types import SimpleNamespace

from yt_dlp import YoutubeDL
from yt_dlp.utils import ExtractorError

sys.path.insert(0, str(Path(__file__).parent / "plugins" / "threads"))
from yt_dlp_plugins.extractor.threads import ThreadsIE, _media_url


class ThreadsTests(unittest.TestCase):
    def test_cli_discovers_the_packaged_extractor(self):
        result = subprocess.run([sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-plugin-dirs",
                                 "--plugin-dirs", str(Path(__file__).parent / "plugins"), "-v", "--list-impersonate-targets"],
                                check=True, capture_output=True, text=True)
        self.assertRegex(result.stderr, r"Extractor Plugins:.*\bThreadsIE\b")

    def extract(self, post, *, code="Target42", extra=None):
        data = {"require": [extra, {"thread_items": [{"post": post}]}]}
        html = f'<script data-sjs type="application/json">{json.dumps(data)}</script>'
        ie = ThreadsIE(YoutubeDL({"quiet": True}))
        ie._download_webpage_handle = lambda *args, **kwargs: (
            html, SimpleNamespace(url=f"https://www.threads.com/@someone/post/{code}?share=1")
        )
        return ie._real_extract("https://www.threads.com/share/Short42/")

    def test_share_link_selects_its_post_not_a_video_in_replies(self):
        main = {"code": "Target42", "video_versions": [
            {"url": "https://scontent.cdninstagram.com/main.mp4"},
            {"url": "https://scontent.cdninstagram.com/main.mp4"},
        ], "original_width": 1280, "original_height": 720,
            "caption": {"text": "Main post"}}
        reply = {"code": "Other99", "video_versions": [
            {"url": "https://scontent.cdninstagram.com/reply.mp4"}]}
        result = self.extract(main, extra=reply)
        self.assertEqual(result["id"], "Target42")
        self.assertEqual(result["title"], "Main post")
        self.assertEqual(len(result["formats"]), 1)
        self.assertEqual(result["formats"][0]["url"], main["video_versions"][0]["url"])
        self.assertEqual(result["formats"][0]["width"], 1280)

    def test_photo_post_does_not_fall_back_to_reply_video(self):
        result = self.extract({"code": "Target42", "image_versions2": {"candidates": [
            {"url": "https://scontent.cdninstagram.com/large.jpg", "width": 2000, "height": 1000},
            {"url": "https://scontent.cdninstagram.com/small.jpg", "width": 200, "height": 100},
        ]}, "caption": {"text": "Photo caption 😀"}}, extra={
            "code": "Reply99", "video_versions": [{"url": "https://scontent.cdninstagram.com/reply.mp4"}]})
        self.assertEqual(result["post_media_type"], "photo")
        self.assertEqual(result["formats"], [])
        self.assertEqual(result["thumbnail"], "https://scontent.cdninstagram.com/large.jpg")
        self.assertEqual(result["description"], "Photo caption 😀")

    def test_text_only_selects_caption_not_reply_media(self):
        result = self.extract({"code": "Target42", "caption": {"text": "Original text 😀"}}, extra={
            "code": "Reply99", "image_versions2": {"candidates": [
                {"url": "https://scontent.cdninstagram.com/reply.jpg"}]}})
        self.assertEqual(result["post_media_type"], "text")
        self.assertEqual(result["description"], "Original text 😀")
        self.assertEqual(result["formats"], [])
        self.assertNotIn("thumbnails", result)

    def test_mixed_carousel_is_direct_original_order(self):
        result = self.extract({"code": "Target42", "caption": {"text": "Album"}, "carousel_media": [
            {"image_versions2": {"candidates": [{"url": "https://scontent.cdninstagram.com/1.jpg"}]}},
            {"video_versions": [{"url": "https://scontent.cdninstagram.com/2.mp4"}]},
            {"image_versions2": {"candidates": [{"url": "https://scontent.cdninstagram.com/3.jpg"}]}},
        ]}, extra={"code": "Other99", "carousel_media": [{"video_versions": [
            {"url": "https://scontent.cdninstagram.com/reply.mp4"}]}]})
        self.assertEqual(result["_type"], "playlist")
        self.assertEqual(result["description"], "Album")
        self.assertEqual([e["post_media_type"] for e in result["entries"]], ["photo", "video", "photo"])
        self.assertEqual([e["id"] for e in result["entries"]], ["Target42-1", "Target42-2", "Target42-3"])

    def test_bad_video_is_not_replaced_with_its_preview(self):
        result = self.extract({"code": "Target42", "video_versions": [{"url": "http://127.0.0.1/v"}],
                               "image_versions2": {"candidates": [
                                   {"url": "https://scontent.cdninstagram.com/preview.jpg"}]}})
        self.assertEqual(result["post_media_type"], "video")
        self.assertEqual(result["formats"], [])
        self.assertNotIn("thumbnail", result)

    def test_bad_photo_keeps_photo_marker_without_reply_fallback(self):
        result = self.extract({"code": "Target42", "image_versions2": {"candidates": [
            {"url": "https://user:pass@scontent.cdninstagram.com/private.jpg"},
            {"url": "https://127.0.0.1/private.jpg"},
        ]}})
        self.assertEqual(result["post_media_type"], "photo")
        self.assertEqual(result["thumbnails"], [])
        self.assertIsNone(result["thumbnail"])
        self.assertIsNone(result["description"])

    def test_processed_photo_and_text_work_with_ignore_no_formats(self):
        # Exercise yt-dlp processing, not just the extractor return dictionary.
        for post in ({"code": "Target42", "caption": {"text": "text"}},
                     {"code": "Target42", "image_versions2": {"candidates": [
                         {"url": "https://scontent.cdninstagram.com/photo.jpg"}]}}):
            result = self.extract(post)
            with YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True,
                            "ignore_no_formats_error": True}) as ydl:
                processed = ydl.process_ie_result(result, download=False)
            self.assertEqual(processed["post_media_type"], result["post_media_type"])
            self.assertEqual(processed.get("description"), result.get("description"))

    def test_missing_post_is_not_replaced_by_an_unrelated_video(self):
        with self.assertRaisesRegex(ExtractorError, "did not return media data"):
            self.extract({"code": "Other99", "video_versions": [{"url": "https://scontent.cdninstagram.com/reply.mp4"}]})

    def test_url_scope(self):
        for url in ("https://www.threads.com/share/Short42/", "https://threads.net/t/Code42/",
                    "https://www.threads.com/@someone/post/Code42"):
            self.assertTrue(ThreadsIE.suitable(url), url)
        self.assertFalse(ThreadsIE.suitable("https://threads.com.evil.example/share/Short42/"))
        self.assertFalse(ThreadsIE.suitable("https://example.com/share/Short42/"))

    def test_media_urls_are_only_https_meta_cdn_without_credentials(self):
        self.assertTrue(_media_url("https://scontent.cdninstagram.com/video.mp4"))
        self.assertTrue(_media_url("https://video.xx.fbcdn.net/video.mp4"))
        for url in ("http://127.0.0.1/video.mp4", "https://cdninstagram.com.evil.example/video.mp4",
                    "https://user:pass@scontent.cdninstagram.com/video.mp4", "file:///etc/passwd"):
            self.assertIsNone(_media_url(url))


if __name__ == "__main__":
    unittest.main()
