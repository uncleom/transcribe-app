#!/bin/sh
# Drop new connections to private and link-local networks. Replies to the
# app stay allowed. The proxy is the check that still runs if this cannot.
if iptables -w -L OUTPUT >/dev/null 2>&1; then
  iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT
  iptables -A OUTPUT -d 0.0.0.0/8 -j REJECT
  iptables -A OUTPUT -d 10.0.0.0/8 -j REJECT
  iptables -A OUTPUT -d 100.64.0.0/10 -j REJECT
  iptables -A OUTPUT -d 169.254.0.0/16 -j REJECT
  iptables -A OUTPUT -d 172.16.0.0/12 -j REJECT
  iptables -A OUTPUT -d 192.168.0.0/16 -j REJECT
  iptables -A OUTPUT -d 224.0.0.0/3 -j REJECT
  if command -v ip6tables >/dev/null 2>&1; then
    ip6tables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    ip6tables -A OUTPUT -d ::1 -j ACCEPT
    ip6tables -A OUTPUT -d fc00::/7 -j REJECT
    ip6tables -A OUTPUT -d fe80::/10 -j REJECT
  fi
  echo "egress filter on"
else
  echo "egress filter skipped"
fi
cd /app
exec setpriv --reuid=node --regid=node --init-groups node /usr/local/bin/node server.mjs
