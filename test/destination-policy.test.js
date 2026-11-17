import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DestinationPolicyError,
  isPublicIpAddress,
  normalizeAuditTarget,
  validatePublicTarget,
} from '../server/destination-policy.js'

test('normalizes HTTP(S) targets and removes fragments without changing queries', () => {
  assert.equal(
    normalizeAuditTarget('  HTTPS://Example.COM:443/path?token=private#section  '),
    'https://example.com/path?token=private',
  )
  assert.equal(
    normalizeAuditTarget('http://example.com:80/'),
    'http://example.com/',
  )
})

test('rejects malformed, credentialed, overlong, or non-default-port targets', () => {
  for (const target of [
    '',
    'example.com',
    'ftp://example.com/',
    'https://user@example.com/',
    'https://@example.com/',
    'https://example.com:8443/',
    `https://example.com/${'x'.repeat(2048)}`,
    'https://exa\nmple.com/',
  ]) {
    assert.throws(
      () => normalizeAuditTarget(target),
      (error) => error instanceof DestinationPolicyError
        && error.code === 'INVALID_TARGET',
      target,
    )
  }
})

test('classifies public and special-use IPv4 and IPv6 addresses', () => {
  for (const address of [
    '1.1.1.1',
    '8.8.8.8',
    '2001:4860:4860::8888',
  ]) {
    assert.equal(isPublicIpAddress(address), true, address)
  }

  for (const address of [
    '0.1.2.3',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '2002::1',
    'not-an-ip',
  ]) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
})

test('requires every DNS answer to be a public address', async () => {
  const resolveHost = async (hostname, options) => {
    assert.equal(hostname, 'example.com')
    assert.deepEqual(options, { all: true, verbatim: true })
    return [{ address: '93.184.216.34', family: 4 }]
  }

  assert.equal(
    await validatePublicTarget('https://example.com/path#fragment', { resolveHost }),
    'https://example.com/path',
  )

  await assert.rejects(
    validatePublicTarget('https://example.com', {
      resolveHost: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
    }),
    { code: 'UNSAFE_TARGET' },
  )
})

test('fails closed on DNS errors, empty answers, invalid addresses, and unsafe IP literals', async () => {
  const resolvers = [
    async () => { throw new Error('private DNS diagnostic') },
    async () => [],
    async () => [{ address: 'not-an-ip', family: 0 }],
  ]
  for (const resolveHost of resolvers) {
    await assert.rejects(
      validatePublicTarget('https://example.com', { resolveHost }),
      { code: 'UNSAFE_TARGET' },
    )
  }

  await assert.rejects(
    validatePublicTarget('http://[::ffff:127.0.0.1]/'),
    { code: 'UNSAFE_TARGET' },
  )
})

test('does not perform DNS resolution for IP literals', async () => {
  const resolveHost = async () => {
    throw new Error('IP literals must not use DNS')
  }
  assert.equal(
    await validatePublicTarget('https://8.8.8.8/', { resolveHost }),
    'https://8.8.8.8/',
  )
})
