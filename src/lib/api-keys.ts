const OWNER_USER_ID = process.env.OWNER_USER_ID

export function resolveGladiaKey(userId?: string | null): string {
  const isOwner = !!userId && userId === OWNER_USER_ID
  const publicKey = process.env.GLADIA_API_KEY_PUBLIC
  return !isOwner && publicKey ? publicKey : process.env.GLADIA_API_KEY!
}

export function resolveGroqKey(userId?: string | null): string {
  const isOwner = !!userId && userId === OWNER_USER_ID
  const publicKey = process.env.GROQ_API_KEY_PUBLIC
  return !isOwner && publicKey ? publicKey : process.env.GROQ_API_KEY!
}
