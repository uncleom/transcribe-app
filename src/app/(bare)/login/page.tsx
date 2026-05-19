import SignInButton from '@/components/SignInButton'

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Transcribo</h1>
          <p className="mt-2 text-sm text-white/40">Sign in to view your transcription history</p>
        </div>
        <SignInButton />
      </div>
    </main>
  )
}
