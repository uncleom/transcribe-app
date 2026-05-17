const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const SUMMARY_MODEL = 'llama-3.3-70b-versatile'

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqResponse {
  choices: Array<{
    message: { content: string }
    finish_reason: string
  }>
}

async function chat(messages: GroqMessage[], apiKey: string): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq API error (${res.status}): ${text}`)
  }

  const data: GroqResponse = await res.json()
  return data.choices[0].message.content.trim()
}

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Brazilian Portuguese',
  ru: 'Russian',
}

/**
 * Generate a concise summary of a transcript.
 * @param transcript Full transcript text
 * @param language   Output language code: 'en' | 'es' | 'pt' | 'ru'
 */
export async function summariseTranscript(
  transcript: string,
  language: string = 'en',
  apiKey: string = process.env.GROQ_API_KEY!
): Promise<string> {
  const langName = LANG_NAMES[language] ?? 'English'

  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant that summarises transcripts concisely. Always respond in ${langName}, regardless of the language of the transcript. Provide a structured summary with key topics and action items if any.`,
    },
    {
      role: 'user',
      content: `Please summarise the following transcript:\n\n${transcript}`,
    },
  ]

  return chat(messages, apiKey)
}

/**
 * Translate a transcript to the target language.
 * @param transcript Full transcript text
 * @param targetLang Target language code: 'en' | 'es' | 'pt' | 'ru'
 */
export async function translateTranscript(
  transcript: string,
  targetLang: string,
  apiKey: string = process.env.GROQ_API_KEY!
): Promise<string> {
  const langName = LANG_NAMES[targetLang] ?? 'English'

  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `You are a professional translator. Translate the following transcript to ${langName}. Preserve the speaker labels (e.g. [Speaker 0]) and paragraph structure. Only output the translated text, nothing else.`,
    },
    {
      role: 'user',
      content: transcript,
    },
  ]

  return chat(messages, apiKey)
}
