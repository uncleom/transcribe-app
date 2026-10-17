const errorMessage = (error) => error instanceof Error ? error.message : String(error ?? "");

function safeAnalysisFailure(error) {
  if (error?.code === "not_configured") return "Анализ изображения недоступен: не настроен доступ к Vertex.";
  if (error?.code === "trial_expired") return "Анализ изображения недоступен: срок Vertex trial истёк.";
  const message = errorMessage(error).toLowerCase();
  if (/missing.?config|not configured|configuration|api.?key/.test(message)) return "Анализ изображения недоступен: не настроена конфигурация сервиса.";
  if (/trial.?expired|trial.*(expire|end)|free.?trial/.test(message)) return "Анализ изображения недоступен: пробный период сервиса закончился.";
  return "Анализ изображения временно недоступен.";
}

export async function deliverPost({ post, sourceUrl, sendText, sendMedia, analyze, transcribe }) {
  try {
    const authorMessage = post.text ? `${post.text}\n\nИсточник: ${sourceUrl}` : `Источник:\n${sourceUrl}`;
    await sendText(authorMessage);
    const availableMedia = post.items.filter((item) => !item.error && item.filePath);
    if (availableMedia.length) {
      const { failed = [] } = await sendMedia(availableMedia);
      for (const index of failed) await sendText(`Не удалось отправить медиа для слайда ${index}.`);
    }
    for (const item of post.items) {
      if (item.error) {
        await sendText(`Слайд ${item.index}: не удалось скачать файл (${item.error}).`);
        continue;
      }
      if (item.type === "photo" && item.filePath) {
        try {
          const result = await analyze(item.filePath);
          const label = result.kind === "text" ? "текст" : "описание";
          await sendText(`Изображение ${item.index} — ${label}:\n${result.text}`);
        } catch (error) {
          await sendText(`Изображение ${item.index}: ${safeAnalysisFailure(error)}`);
        }
        continue;
      }
      if (item.type === "video") {
        if (item.audioPath) {
          try { await transcribe(item); }
          catch { await sendText(`Видео ${item.index}: не удалось расшифровать аудио.`); }
        } else {
          await sendText(`Видео ${item.index}: нет доступного аудио для расшифровки.`);
        }
        if (item.videoTooBig) await sendText(`Видео ${item.index} слишком большое для отправки; доступна только расшифровка аудио.`);
      }
    }
  } finally {
    await post.cleanup();
  }
}
