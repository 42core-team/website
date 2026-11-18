package kube

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	// botBaseUID is the uid of the first bot. Without port isolation every
	// bot runs as this uid; with it, bot i runs as botBaseUID+i.
	botBaseUID int64 = 2000
	// defaultGameServerPort is the port bots and client libraries connect to.
	defaultGameServerPort = 4444
	// teamPortBase is the game server port of the first bot when port
	// isolation is on; bot i gets teamPortBase+i.
	teamPortBase = 4501
)

// botSlot is the network identity of one bot in a game: the uid its
// containers run as and the game server port it is bound to.
type botSlot struct {
	uid  int64
	port int
}

// botSlots returns the slots of n bots. Without port isolation every bot
// shares botBaseUID and has no port of its own.
func botSlots(n int, portIsolation bool) []botSlot {
	slots := make([]botSlot, n)
	for i := range slots {
		if portIsolation {
			slots[i] = botSlot{uid: botBaseUID + int64(i), port: teamPortBase + i}
		} else {
			slots[i] = botSlot{uid: botBaseUID}
		}
	}
	return slots
}

// teamPortsEnv returns the TEAM_PORTS value for the game server:
// comma-separated <RndID>=<port> pairs in bot order.
func teamPortsEnv(botIDs []string, slots []botSlot) string {
	pairs := make([]string, len(botIDs))
	for i, id := range botIDs {
		pairs[i] = id + "=" + strconv.Itoa(slots[i].port)
	}
	return strings.Join(pairs, ",")
}

// legacyNetGuardScript is the net-guard script without port isolation. It is
// kept byte for byte as it was before port isolation existed.
func legacyNetGuardScript(uid int64) string {
	return fmt.Sprintf(`
				set -eux;
				# Block all non-loopback egress for bot UID
				iptables -I OUTPUT 1 -m owner --uid-owner %d ! -o lo -j DROP;
				ip6tables -I OUTPUT 1 -m owner --uid-owner %d ! -o lo -j DROP;
			`, uid, uid)
}

// netGuardScript returns the net-guard script with port isolation. It only
// contains integers chosen by the service, never game data.
//
// For every bot uid it
//   - drops all non-loopback egress (IPv4 and IPv6);
//   - redirects IPv4 loopback connections to defaultGameServerPort to the
//     bot's own team port (nat OUTPUT, which runs before filter OUTPUT);
//   - drops IPv4 loopback connections to the other teams' ports. A redirected
//     connection already has its own port as destination when it reaches the
//     filter table, so it is not affected;
//   - drops IPv6 loopback connections to the other teams' ports and to
//     defaultGameServerPort. IPv6 is not redirected (ip6tables nat may be
//     missing on the node, and clients use 127.0.0.1); only the filter table
//     is used, so the script does not depend on IPv6 nat;
//   - drops its outgoing TCP packets whose source port is
//     defaultGameServerPort or any team port (its own included), on every
//     interface and for IPv4 and IPv6. A bot that binds one of these ports
//     before the game server does can then never answer a connection. The
//     bot's own client connections use ephemeral source ports, so legitimate
//     traffic is unaffected.
//
// Rules are inserted at explicit positions from the top of each chain, so
// they stay in this order and ahead of any rule that already exists.
func netGuardScript(slots []botSlot) string {
	var b strings.Builder
	v4Filter, v4Nat, v6Filter := 0, 0, 0
	rule := func(cmd string, pos *int, table, match string) {
		*pos++
		fmt.Fprintf(&b, "%s%s -I OUTPUT %d %s\n", cmd, table, *pos, match)
	}

	b.WriteString("set -eux\n")
	for i, slot := range slots {
		fmt.Fprintf(&b, "# Bot %d: uid %d, game server port %d\n", i, slot.uid, slot.port)
		owner := fmt.Sprintf("-m owner --uid-owner %d", slot.uid)

		rule("iptables", &v4Filter, "", owner+" ! -o lo -j DROP")
		rule("iptables", &v4Nat, " -t nat", fmt.Sprintf("-o lo -p tcp --dport %d %s -j REDIRECT --to-ports %d", defaultGameServerPort, owner, slot.port))
		for j, other := range slots {
			if j != i {
				rule("iptables", &v4Filter, "", fmt.Sprintf("-o lo -p tcp --dport %d %s -j DROP", other.port, owner))
			}
		}
		for _, port := range serverPorts(slots) {
			rule("iptables", &v4Filter, "", fmt.Sprintf("-p tcp --sport %d %s -j DROP", port, owner))
		}

		rule("ip6tables", &v6Filter, "", owner+" ! -o lo -j DROP")
		rule("ip6tables", &v6Filter, "", fmt.Sprintf("-o lo -p tcp --dport %d %s -j DROP", defaultGameServerPort, owner))
		for j, other := range slots {
			if j != i {
				rule("ip6tables", &v6Filter, "", fmt.Sprintf("-o lo -p tcp --dport %d %s -j DROP", other.port, owner))
			}
		}
		for _, port := range serverPorts(slots) {
			rule("ip6tables", &v6Filter, "", fmt.Sprintf("-p tcp --sport %d %s -j DROP", port, owner))
		}
	}
	return b.String()
}

// serverPorts returns the ports only the game server may serve on:
// defaultGameServerPort followed by every team port.
func serverPorts(slots []botSlot) []int {
	ports := []int{defaultGameServerPort}
	for _, slot := range slots {
		ports = append(ports, slot.port)
	}
	return ports
}
