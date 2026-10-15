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

    def test_photo_post_does_not_fall_back_to_video_from_another_post(self):
        with self.assertRaisesRegex(ExtractorError, "No video found"):
            self.extract({"code": "Target42", "video_versions": []}, extra={
                "code": "Reply99", "video_versions": [{"url": "https://scontent.cdninstagram.com/reply.mp4"}]})

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
