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

async function chat(messages: GroqMessage[]): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
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

/**
 * Generate a concise summary of a transcript.
 * @param transcript Full transcript text
 * @param language   Language code (e.g. "ru", "en") for response localisation
 */
export async function summariseTranscript(
  transcript: string,
  language: string = 'en'
): Promise<string> {
  const langInstruction =
    language !== 'en'
      ? `Respond in the same language as the transcript (${language}).`
      : 'Respond in English.'

  const messages: GroqMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant that summarises transcripts concisely. ${langInstruction} Provide a structured summary with key topics and action items if any.`,
    },
    {
      role: 'user',
      content: `Please summarise the following transcript:\n\n${transcript}`,
    },
  ]

  return chat(messages)
}
