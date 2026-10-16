import type { CollectionEntry } from 'astro:content';

type Site = CollectionEntry<'sites'>['data'];

export interface SiteCard {
  url: string;
  hostname: string;
  title: string;
  description?: string;
  image?: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
}

const TIMEOUT_MS = 10_000;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const num = code[1].toLowerCase() === 'x'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isNaN(num) ? match : String.fromCodePoint(num);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const [, name, dq, sq, bare] of tag.matchAll(pattern)) {
    attrs[name.toLowerCase()] = decodeEntities(dq ?? sq ?? bare ?? '').trim();
  }
  return attrs;
}

/**
 * Collect `<meta>` tags keyed by `property` or `name` (lowercased).
 * The first occurrence wins, matching how most unfurlers behave.
 */
function parseMeta(html: string): Map<string, string> {
  const meta = new Map<string, string>();
  const head = html.split(/<\/head>/i)[0];
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag);
    const key = (attrs.property ?? attrs.name)?.toLowerCase();
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content);
  }
  return meta;
}

function parseTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).trim() || undefined : undefined;
}

function toInt(value: string | undefined, fallback: number): number {
  const num = Number.parseInt(value ?? '', 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Confirm an OG image actually loads so a misconfigured site (e.g. one
 * built with a localhost `og:image`) doesn't render a broken image here.
 */
async function isImageReachable(src: string): Promise<boolean> {
  const { hostname } = new URL(src);
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  try {
    const response = await fetch(src, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Some hosts don't support HEAD; don't reject the image for that alone.
    if (response.status === 405 || response.status === 501) return true;
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchCard(site: Site): Promise<SiteCard> {
  const { hostname } = new URL(site.url);
  const fallback: SiteCard = {
    url: site.url,
    hostname,
    title: hostname,
  };

  try {
    const response = await fetch(site.url, {
      headers: { 'user-agent': 'damato.design hub (+https://damato.design)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const meta = parseMeta(html);
    // Resolve relative image paths against the final URL after redirects.
    const base = response.url || site.url;

    const title = meta.get('og:title') ?? meta.get('twitter:title') ?? parseTitle(html);
    const description = meta.get('og:description')
      ?? meta.get('twitter:description')
      ?? meta.get('description');
    const imageUrl = meta.get('og:image:secure_url')
      ?? meta.get('og:image')
      ?? meta.get('og:image:url')
      ?? meta.get('twitter:image');
    const imageSrc = imageUrl ? new URL(imageUrl, base).href : undefined;
    const hasImage = imageSrc ? await isImageReachable(imageSrc) : false;
    if (imageSrc && !hasImage) {
      console.warn(`[og] Skipping unreachable og:image for ${site.url}: ${imageSrc}`);
    }

    return {
      ...fallback,
      title: title ?? fallback.title,
      description,
      image: imageSrc && hasImage
        ? {
            src: imageSrc,
            alt: meta.get('og:image:alt') ?? meta.get('twitter:image:alt') ?? '',
            width: toInt(meta.get('og:image:width'), 1200),
            height: toInt(meta.get('og:image:height'), 630),
          }
        : undefined,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[og] Could not read Open Graph tags for ${site.url}: ${reason}`);
    return fallback;
  }
}

export function getSiteCards(sites: Site[]): Promise<SiteCard[]> {
  return Promise.all(sites.map(fetchCard));
}
