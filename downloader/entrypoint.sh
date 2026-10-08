#!/bin/sh
# Without these rules the process must not start. Replies to the app stay
# allowed. The proxy inside the process is the second check.
set -e
iptables -w -L OUTPUT >/dev/null
ip6tables -w -L OUTPUT >/dev/null
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT
iptables -A OUTPUT -d 0.0.0.0/8 -j REJECT
iptables -A OUTPUT -d 10.0.0.0/8 -j REJECT
iptables -A OUTPUT -d 100.64.0.0/10 -j REJECT
iptables -A OUTPUT -d 169.254.0.0/16 -j REJECT
iptables -A OUTPUT -d 172.16.0.0/12 -j REJECT
iptables -A OUTPUT -d 192.168.0.0/16 -j REJECT
iptables -A OUTPUT -d 224.0.0.0/3 -j REJECT
ip6tables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
ip6tables -A OUTPUT -d ::1 -j ACCEPT
ip6tables -A OUTPUT -d fc00::/7 -j REJECT
ip6tables -A OUTPUT -d fe80::/10 -j REJECT
ip6tables -A OUTPUT -d ::ffff:0:0/96 -j REJECT
echo "egress filter on"
cd /app
exec setpriv --reuid=node --regid=node --init-groups -- /usr/local/bin/node server.mjs
