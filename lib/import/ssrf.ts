import dns from 'node:dns/promises'

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase()
    return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')
  }
  const parts = ip.split('.').map(Number)
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw)
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('BAD_PROTOCOL')
  const addrs = await dns.lookup(u.hostname, { all: true })
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('PRIVATE_ADDRESS')
  return u
}

export async function safeFetch(raw: string, hops = 0): Promise<Response> {
  if (hops > 5) throw new Error('TOO_MANY_REDIRECTS')
  const u = await assertPublicUrl(raw)
  const res = await fetch(u.toString(), {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Accept-Language': 'fr,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })
  const loc = res.headers.get('location')
  if (res.status >= 300 && res.status < 400 && loc) {
    return safeFetch(new URL(loc, u).href, hops + 1)
  }
  return res
}

export async function fetchText(url: string): Promise<string> {
  const res = await safeFetch(url)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
  const buf = await res.arrayBuffer()
  if (buf.byteLength > 5_000_000) throw new Error('TOO_LARGE')
  return new TextDecoder().decode(buf)
}

export function cleanSourceUrl(raw: string): string {
  try {
    const u = new URL(raw)
    ;[...u.searchParams.keys()]
      .filter((k) => k === 'fbclid' || k.startsWith('utm_'))
      .forEach((k) => u.searchParams.delete(k))
    return u.href
  } catch {
    return raw
  }
}
