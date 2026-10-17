import test from "node:test";
import assert from "node:assert/strict";
import { deliverPost } from "../src/lib/process-post.mjs";

const makePost = (items, text = "Авторский текст") => ({ text, items, cleanup: async () => {} });

test("processes media in original order and never transcribes photos", async () => {
  const calls = [];
  const post = makePost([
    { index: 1, type: "video", filePath: "/v1", audioPath: "/a1", videoTooBig: false, error: null },
    { index: 2, type: "photo", filePath: "/p2", audioPath: null, videoTooBig: false, error: null },
    { index: 3, type: "video", filePath: "/v3", audioPath: "/a3", videoTooBig: false, error: null },
  ]);
  await deliverPost({ post, sourceUrl: "https://example.test/post", sendText: async (text) => calls.push(["text", text]), sendMedia: async () => ({ failed: [] }),
    analyze: async (path) => { calls.push(["analyze", path]); return { kind: "text", text: "OCR полный" }; }, transcribe: async (item) => calls.push(["transcribe", item.index]) });
  assert.deepEqual(calls.filter(([kind]) => kind !== "text"), [["transcribe", 1], ["analyze", "/p2"], ["transcribe", 3]]);
  assert.ok(calls.some(([kind, text]) => kind === "text" && text === "Изображение 2 — текст:\nOCR полный"));
});

test("photo-only and text-only posts do not invoke transcription", async () => {
  let analyzed = 0, transcribed = 0;
  const run = (post) => deliverPost({ post, sourceUrl: "https://example.test/source", sendText: async () => {}, sendMedia: async () => ({ failed: [] }),
    analyze: async () => { analyzed++; return { kind: "description", text: "описание" }; }, transcribe: async () => { transcribed++; } });
  await run(makePost([{ index: 1, type: "photo", filePath: "/p", audioPath: null, videoTooBig: false, error: null }]));
  await run(makePost([]));
  assert.equal(analyzed, 1); assert.equal(transcribed, 0);
});

test("analysis failure preserves author post and continues to the next video", async () => {
  const sent = [];
  const post = makePost([{ index: 1, type: "photo", filePath: "/p", audioPath: null, videoTooBig: false, error: null }, { index: 2, type: "video", filePath: "/v", audioPath: "/a", videoTooBig: false, error: null }]);
  await deliverPost({ post, sourceUrl: "https://example.test/source", sendText: async (text) => sent.push(text), sendMedia: async () => ({ failed: [] }),
    analyze: async () => { throw new Error("trial expired"); }, transcribe: async (item) => sent.push(`transcribed ${item.index}`) });
  assert.ok(sent[0].includes("Авторский текст")); assert.ok(sent[0].includes("https://example.test/source"));
  assert.ok(sent.some((text) => text.includes("пробный период"))); assert.ok(sent.includes("transcribed 2"));
});

test("reports download and partial media failures and cleans up on send failure", async () => {
  const sent = []; let cleaned = false;
  const post = makePost([{ index: 4, type: "photo", filePath: null, audioPath: null, videoTooBig: false, error: "404" }, { index: 5, type: "photo", filePath: "/p", audioPath: null, videoTooBig: false, error: null }]);
  post.cleanup = async () => { cleaned = true; };
  await deliverPost({ post, sourceUrl: "https://example.test/source", sendText: async (text) => sent.push(text), sendMedia: async () => ({ failed: [5] }),
    analyze: async () => ({ kind: "description", text: "описание" }), transcribe: async () => {} });
  assert.ok(sent.some((text) => text.includes("Слайд 4"))); assert.ok(sent.some((text) => text.includes("слайда 5"))); assert.equal(cleaned, true);
  const failedPost = makePost([]); failedPost.cleanup = async () => { cleaned = true; };
  await assert.rejects(deliverPost({ post: failedPost, sourceUrl: "https://example.test/source", sendText: async () => { throw new Error("send failed"); }, sendMedia: async () => ({ failed: [] }), analyze: async () => ({}), transcribe: async () => {} }), /send failed/);
  assert.equal(cleaned, true);
});

test("missing author text still sends the source URL under its own heading", async () => {
  let message;
  await deliverPost({ post: makePost([], ""), sourceUrl: "https://example.test/source", sendText: async (text) => { message = text; }, sendMedia: async () => ({ failed: [] }), analyze: async () => ({}), transcribe: async () => {} });
  assert.equal(message, "Источник:\nhttps://example.test/source");
});
