// Which music services to offer on the sign-in screen: only the ones this server has set up
// (a shared Spotify-only site shows just Spotify). If none is set up, list them all so the
// "not set up" hints explain what to configure.
export function visibleServices(services) {
  const configured = services.filter((svc) => svc.configured);
  return configured.length ? configured : services;
}
