import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Handles Supabase OAuth PKCE code exchange callback.
 * Exchanges the temporary authorization code for an authenticated session
 * and sets the session cookies server-side before redirecting to the destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }

    console.error('[NEXUS AUTH] OAuth code exchange failed:', error.message);
  }

  // Redirect to login with error parameter if code exchange was unsuccessful
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
