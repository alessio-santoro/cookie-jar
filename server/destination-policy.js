import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_URL_LENGTH = 2048
const IPV4_NON_PUBLIC_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.31.196.0/24',
  '192.52.193.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '192.175.48.0/24',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
]
const IPV6_GLOBAL_UNICAST = '2000::/3'
const IPV6_NON_PUBLIC_RANGES = [
  '2001::/23',
  '2001:db8::/32',
  '2002::/16',
]

export class DestinationPolicyError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'DestinationPolicyError'
    this.code = code
  }
}

function invalidTarget() {
  return new DestinationPolicyError(
    'INVALID_TARGET',
    'Provide an absolute HTTP or HTTPS website address using its default port.',
  )
}

function unsafeTarget() {
  return new DestinationPolicyError(
    'UNSAFE_TARGET',
    'The destination could not be verified as a public internet address.',
  )
}

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })
}

function parseIpv4(value) {
  return value.split('.').reduce((result, part) => (
    (result << 8n) | BigInt(Number(part))
  ), 0n)
}

function parseIpv6(value) {
  let normalized = value.toLowerCase()
  const embeddedIpv4 = normalized.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (embeddedIpv4) {
    const ipv4Value = parseIpv4(embeddedIpv4[1])
    const high = Number((ipv4Value >> 16n) & 0xffffn).toString(16)
    const low = Number(ipv4Value & 0xffffn).toString(16)
    normalized = `${normalized.slice(0, -embeddedIpv4[1].length)}${high}:${low}`
  }

  const halves = normalized.split('::')
  if (halves.length > 2) return null
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const zeroCount = 8 - left.length - right.length
  if ((halves.length === 1 && zeroCount !== 0)
    || (halves.length === 2 && zeroCount < 1)) {
    return null
  }

  const groups = [
    ...left,
    ...Array(halves.length === 2 ? zeroCount : 0).fill('0'),
    ...right,
  ]
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) {
    return null
  }

  return groups.reduce((result, group) => (
    (result << 16n) | BigInt(Number.parseInt(group, 16))
  ), 0n)
}

function parseIpAddress(value) {
  const version = isIP(value)
  if (version === 4) return { version, value: parseIpv4(value) }
  if (version === 6) {
    const parsed = parseIpv6(value)
    return parsed === null ? null : { version, value: parsed }
  }
  return null
}

function isInCidr(address, cidr) {
  const [network, prefixText] = cidr.split('/')
  const parsedNetwork = parseIpAddress(network)
  if (!parsedNetwork || parsedNetwork.version !== address.version) return false

  const prefix = Number(prefixText)
  const width = address.version === 4 ? 32n : 128n
  const shift = width - BigInt(prefix)
  return (address.value >> shift) === (parsedNetwork.value >> shift)
}

export function isPublicIpAddress(value) {
  const address = parseIpAddress(value)
  if (!address) return false

  if (address.version === 4) {
    return !IPV4_NON_PUBLIC_RANGES.some((range) => isInCidr(address, range))
  }

  return isInCidr(address, IPV6_GLOBAL_UNICAST)
    && !IPV6_NON_PUBLIC_RANGES.some((range) => isInCidr(address, range))
}

export function normalizeAuditTarget(value) {
  if (typeof value !== 'string'
    || value.length > MAX_URL_LENGTH
    || hasControlCharacters(value)) {
    throw invalidTarget()
  }

  const input = value.trim()
  const authority = input.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1]
  if (!authority || authority.includes('@')) throw invalidTarget()

  let target
  try {
    target = new URL(input)
  } catch {
    throw invalidTarget()
  }

  if (!['http:', 'https:'].includes(target.protocol)
    || !target.hostname
    || target.username
    || target.password
    || target.port) {
    throw invalidTarget()
  }

  target.hash = ''
  return target.toString()
}

function resolverAddresses(result) {
  if (typeof result === 'string') return [result]
  if (!Array.isArray(result)) return []
  return result.map((entry) => (
    typeof entry === 'string' ? entry : entry?.address
  ))
}

export async function validatePublicTarget(value, { resolveHost = lookup } = {}) {
  const normalized = normalizeAuditTarget(value)
  const target = new URL(normalized)
  const hostname = target.hostname.replace(/^\[|\]$/g, '')

  let addresses
  if (isIP(hostname)) {
    addresses = [hostname]
  } else {
    try {
      addresses = resolverAddresses(await resolveHost(hostname, {
        all: true,
        verbatim: true,
      }))
    } catch {
      throw unsafeTarget()
    }
  }

  if (addresses.length === 0 || !addresses.every(isPublicIpAddress)) {
    throw unsafeTarget()
  }

  return normalized
}
