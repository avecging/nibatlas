/**
 * The one navigation the interruption performs itself.
 *
 * Google's flow cannot happen inside `fetch`: the provider exchange is a
 * cross-origin redirect chain, so the route returns the URL and the browser has
 * to be the thing that leaves. That single call to `location.assign` lives here
 * rather than inline, because a real navigation cannot be exercised in a
 * component test — jsdom neither performs it nor allows `location` to be
 * replaced — and a seam is a smaller price than an untested branch.
 *
 * `startGoogleSignIn` has already checked that the URL is absolute http(s), on
 * top of the route's own check that it is the configured Supabase authorize
 * endpoint. Nothing else in the application calls this.
 */
export function leaveForProvider(url: string): void {
  window.location.assign(url);
}
