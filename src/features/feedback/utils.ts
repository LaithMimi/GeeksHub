/** Matches a canonical UUID anywhere in a string. */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Strip UUID path segments (e.g. `/courses/<uuid>/files/<uuid>`) down to a
 * readable route so raw identifiers never surface in the moderator UI. Applied
 * both when capturing the page and when rendering it, for defense in depth.
 */
export const sanitizePagePath = (path: string): string => path.replace(UUID_RE, "…");
