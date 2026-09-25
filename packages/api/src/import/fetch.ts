import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { ApiError } from '../errors.js';

const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
export function importError(message: string): ApiError {
  return new ApiError(422, 'import_failed', message);
}

// Only globally routable addresses. This excludes loopback, private networks,
// link-local/metadata, multicast, reserved ranges and IPv4-mapped IPv6. Checking
// DNS alone is insufficient: the actual socket must use the checked address,
// otherwise a second DNS answer can rebind a public name to a household host.
export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    return parsed.range() === 'unicast';
  } catch {
    return false;
  }
}
export function publicPageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw importError('Enter a valid public recipe link.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port)) ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    (isIP(host) && !isPublicAddress(host))
  ) {
    throw importError(
      'Use a public HTTP or HTTPS recipe page. Local and private addresses are blocked.',
    );
  }
  url.hash = '';
  return url;
}

export type ResolveAddresses = (hostname: string) => Promise<{ address: string; family: number }[]>;
export async function resolvePublicAddress(
  url: URL,
  resolve: ResolveAddresses = (host) => lookup(host, { all: true }),
) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw importError(
      'This link resolves to a private or unsupported address. Try a public recipe page.',
    );
  }
  return addresses[0];
}

interface PageResponse {
  status: number;
  location?: string;
  data: Buffer;
}
function requestPage(
  url: URL,
  address: { address: string; family: number },
  signal: AbortSignal,
  image: boolean,
): Promise<PageResponse> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
      url,
      {
        signal,
        // No pooled socket, proxies, cookies, authorization headers or second DNS
        // lookup. TLS still verifies the URL hostname, not the pinned IP.
        agent: false,
        lookup: (_hostname, options, callback) =>
          options.all ? callback(null, [address]) : callback(null, address.address, address.family),
        headers: {
          Accept: image ? 'image/jpeg, image/png, image/webp' : 'text/html, application/xhtml+xml',
          'Accept-Encoding': 'identity',
          'User-Agent': 'CookbookRecipeImport/1.0',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          resolve({ status, location: response.headers.location, data: Buffer.alloc(0) });
          response.destroy();
          return;
        }
        if (status !== 200) {
          reject(
            importError(
              'This page could not be opened. Try another link, upload a screenshot, or enter the recipe manually.',
            ),
          );
          response.destroy();
          return;
        }
        const type = response.headers['content-type'] ?? '';
        if (
          !(
            image ? /^image\/(jpeg|png|webp)(;|$)/i : /^(text\/html|application\/xhtml\+xml)(;|$)/i
          ).test(type) ||
          (response.headers['content-encoding'] &&
            response.headers['content-encoding'] !== 'identity')
        ) {
          reject(
            importError(
              'This link is not a supported recipe web page. Upload a screenshot instead.',
            ),
          );
          response.destroy();
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > (image ? 10 * 1024 * 1024 : MAX_PAGE_BYTES)) {
            reject(importError('This page is too large to import. Upload a screenshot instead.'));
            response.destroy();
          } else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => resolve({ status, data: Buffer.concat(chunks) }));
      },
    );
    request.on('error', reject);
    request.end();
  });
}

export async function fetchPublicResource(
  value: string,
  image = false,
): Promise<{ data: Buffer; url: string }> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    let url = publicPageUrl(value);
    for (let redirects = 0; redirects <= 4; redirects++) {
      // DNS is part of the same overall deadline as all redirects and reads.
      const address = await Promise.race([
        resolvePublicAddress(url),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
          if (signal.aborted) reject(new Error('timeout'));
        }),
      ]);
      const page = await requestPage(url, address, signal, image);
      if (page.status === 200) return { data: page.data, url: url.href };
      if (!page.location)
        throw importError('This page redirects without a destination. Try its direct recipe link.');
      url = publicPageUrl(new URL(page.location, url).href);
    }
    throw importError('This page redirects too many times. Try its direct recipe link.');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw importError(
      'This page could not be reached in time. Try again, upload a screenshot, or enter the recipe manually.',
    );
  }
}

export async function fetchRecipePage(value: string) {
  const result = await fetchPublicResource(value);
  return { html: result.data.toString('utf8'), url: result.url };
}
