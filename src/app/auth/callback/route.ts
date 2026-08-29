import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Supabase sends the user here after they click the email confirmation link.
// We exchange the `code` query param for a session and redirect to /dashboard.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If exchange failed, redirect to login with an error indicator
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}
