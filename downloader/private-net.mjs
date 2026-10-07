import { BlockList, isIP } from 'node:net'

const PRIVATE = new BlockList()
PRIVATE.addSubnet('0.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('10.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('127.0.0.0', 8, 'ipv4')
PRIVATE.addSubnet('100.64.0.0', 10, 'ipv4')
PRIVATE.addSubnet('169.254.0.0', 16, 'ipv4')
PRIVATE.addSubnet('172.16.0.0', 12, 'ipv4')
PRIVATE.addSubnet('192.168.0.0', 16, 'ipv4')
PRIVATE.addSubnet('224.0.0.0', 3, 'ipv4')
PRIVATE.addAddress('::1', 'ipv6')
PRIVATE.addAddress('::', 'ipv6')
PRIVATE.addSubnet('fc00::', 7, 'ipv6')
PRIVATE.addSubnet('fe80::', 10, 'ipv6')

export function isPrivateAddress(address) {
  const mapped = String(address).toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  const ip = mapped ? mapped[1] : address
  const kind = isIP(ip)
  if (kind === 4) return PRIVATE.check(ip, 'ipv4')
  if (kind === 6) return PRIVATE.check(ip, 'ipv6')
  return true
}

export function isBlockedHostname(hostname) {
  const host = String(hostname).replace(/^\[|\]$/g, '').toLowerCase()
  if (!host) return true
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home.arpa')) return true
  if (isIP(host)) return isPrivateAddress(host)
  return false
}
