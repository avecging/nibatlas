// Safe placeholder until the isolated staging application is configured.
// No database, authentication, media, or external network operations.
const stagingPlaceholder = {
  async fetch() {
    return new Response('Nib Atlas staging setup is pending.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};

export default stagingPlaceholder;
