import { type LookupAddress, lookup } from 'node:dns'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { z } from 'zod'
import { InvalidClientError } from '@/domain/oauth/errors/invalid-client.error'
import type {
  ClientMetadata,
  ClientMetadataSource,
} from '@/domain/oauth/ports/client-metadata.port'

// The draft's recommended ceiling: a description of a client has no reason to be larger.
const MAX_BYTES = 5 * 1024
const TIMEOUT_MS = 5000
const MAX_CACHE_MS = 60 * 60 * 1000

// Anything that is not the public internet. The client chooses the URL, so without this list it could make the API
// read its own network.
const PRIVATE = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv4')
}

// An IPv4-mapped address (::ffff:127.0.0.1) is checked against the IPv4 rules by BlockList itself; a rule for the
// whole mapped range would match every IPv4 address, public ones included.
for (const [network, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv6')
}

export function isPrivateAddress(address: string): boolean {
  return PRIVATE.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4')
}

const documentSchema = z.object({
  client_id: z.string(),
  client_name: z.string().trim().min(1).max(200),
  redirect_uris: z.array(z.string()).min(1).max(20),
  // A document is public by nature, so it cannot hold a secret, and a key-based method is not supported here.
  token_endpoint_auth_method: z.literal('none').optional(),
  client_secret: z.never().optional(),
  client_secret_expires_at: z.never().optional(),
})

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function fail(message: string): never {
  throw new InvalidClientError(message)
}

// https, a path, no credentials, no query, no fragment, no dot segments: and written exactly as the URL parser
// would write it, since the document's client_id is compared to it character by character.
function clientUrl(clientId: string): URL {
  const url = URL.canParse(clientId) ? new URL(clientId) : fail('client_id is not a URL')

  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.pathname === '/' ||
    url.href !== clientId
  ) {
    fail('client_id must be a canonical https URL with a path, and nothing else')
  }

  return url
}

// HTTPS anywhere, or plain HTTP back to this device, as MCP allows for native clients.
function isAllowedRedirect(uri: string): boolean {
  if (!URL.canParse(uri)) {
    return false
  }

  const url = new URL(uri)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)

  return url.hash === '' && (url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
}

// The connection goes to the address checked here, so a name that resolves differently a second time cannot reach
// the private network after passing.
function guardedLookup(
  hostname: string,
  options: { all?: boolean },
  callback: (error: Error | null, address: string | LookupAddress[], family?: number) => void,
): void {
  lookup(hostname, { all: true }, (error, addresses) => {
    if (error !== null) {
      callback(error, [])
      return
    }

    if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
      callback(new Error(`${hostname} resolves to a private address`), [])
      return
    }

    const [first] = addresses as [LookupAddress]

    if (options.all === true) {
      callback(null, addresses)
    } else {
      callback(null, first.address, first.family)
    }
  })
}

function download(url: URL): Promise<{ body: string; maxAgeMs: number }> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'GET', headers: { accept: 'application/json' }, lookup: guardedLookup as never },
      (res) => {
        if (res.statusCode !== 200) {
          res.destroy()
          reject(new Error(`answered ${res.statusCode}`))
          return
        }

        const chunks: Buffer[] = []
        let size = 0

        res.on('data', (chunk: Buffer) => {
          size += chunk.length

          if (size > MAX_BYTES) {
            res.destroy(new Error(`is larger than ${MAX_BYTES} bytes`))
          } else {
            chunks.push(chunk)
          }
        })
        res.on('error', reject)
        res.on('end', () => {
          const maxAge = /max-age=(\d+)/.exec(res.headers['cache-control'] ?? '')?.[1]
          const cacheable = !/no-store|no-cache/.test(res.headers['cache-control'] ?? '')

          resolve({
            body: Buffer.concat(chunks).toString('utf8'),
            maxAgeMs:
              cacheable && maxAge !== undefined ? Math.min(Number(maxAge) * 1000, MAX_CACHE_MS) : 0,
          })
        })
      },
    )

    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('timed out')))
    req.on('error', reject)
    req.end()
  })
}

export class HttpsClientMetadata implements ClientMetadataSource {
  private readonly cache = new Map<string, { metadata: ClientMetadata; until: number }>()

  async read(clientId: string): Promise<ClientMetadata> {
    const cached = this.cache.get(clientId)

    if (cached !== undefined && cached.until > Date.now()) {
      return cached.metadata
    }

    const url = clientUrl(clientId)
    const host = url.hostname.replace(/^\[|\]$/g, '')

    // A literal address is connected to directly, without the lookup that guards a name.
    if (isIP(host) !== 0 && isPrivateAddress(host)) {
      fail('client_id points at a private address')
    }

    const { body, maxAgeMs } = await download(url).catch((error: Error) =>
      fail(`The client metadata document could not be read: ${error.message}`),
    )
    const parsed = documentSchema.safeParse(parseJson(body))

    if (!parsed.success) {
      fail('The client metadata document is not a valid public client description')
    }

    if (parsed.data.client_id !== clientId) {
      fail('The client metadata document names another client_id')
    }

    if (!parsed.data.redirect_uris.every(isAllowedRedirect)) {
      fail('Every redirect URI must be https, or http to localhost')
    }

    const metadata = {
      clientId,
      clientName: parsed.data.client_name,
      redirectUris: parsed.data.redirect_uris,
    }

    // Only a valid document is kept, and only as long as its server says it may be.
    if (maxAgeMs > 0) {
      this.cache.set(clientId, { metadata, until: Date.now() + maxAgeMs })
    }

    return metadata
  }
}
