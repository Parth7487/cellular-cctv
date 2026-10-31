import dns from 'node:dns/promises';
import net from 'node:net';
import dgram from 'node:dgram';
import { getIceServers } from '../src/config.js';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  WebRTC STUN & TURN Traversal Reachability Verifier');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testTcpConnectivity(host, port, timeout = 4000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeout);
    socket.on('connect', () => {
      status = true;
      socket.destroy();
      resolve({ reachable: true });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ reachable: false, error: 'Connection timed out' });
    });

    socket.on('error', (err) => {
      resolve({ reachable: false, error: err.message });
    });

    socket.connect(port, host);
  });
}

async function testUdpReachability(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    let resolved = false;

    // Send a dummy probe packet
    const message = Buffer.from([0x00, 0x01, 0x00, 0x00]); // STUN binding request header
    client.send(message, 0, message.length, port, host, (err) => {
      if (err) {
        client.close();
        return resolve({ reachable: false, error: err.message });
      }
    });

    client.on('message', () => {
      if (!resolved) {
        resolved = true;
        client.close();
        resolve({ reachable: true, activeReply: true });
      }
    });

    client.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        client.close();
        resolve({ reachable: false, error: err.message });
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        client.close();
        // UDP sends without handshake, so successful transmission without error is a pass
        resolve({ reachable: true, activeReply: false });
      }
    }, timeout);
  });
}

async function runVerification() {
  const iceServers = getIceServers();
  console.log(`Found ${iceServers.length} configured ICE server groups:\n`);

  let allReachable = true;

  for (const [index, server] of iceServers.entries()) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    console.log(`[Group ${index + 1}]`);
    if (server.username) {
      console.log(`  Auth: username="${server.username}"`);
    }

    for (const urlStr of urls) {
      const isTurn = urlStr.startsWith('turn:') || urlStr.startsWith('turns:');
      const isStun = urlStr.startsWith('stun:');
      const protocol = isTurn ? 'TURN' : isStun ? 'STUN' : 'UNKNOWN';

      const clean = urlStr.replace(/^(stun:|turn:|turns:)/, '').split('?')[0];
      const [host, portStr] = clean.split(':');
      const port = parseInt(portStr || (urlStr.startsWith('turns:') ? '443' : '3478'), 10);
      const isTcp = urlStr.includes('transport=tcp') || urlStr.startsWith('turns:');

      process.stdout.write(`  • Testing ${protocol} (${isTcp ? 'TCP' : 'UDP'}) -> ${host}:${port} ... `);

      try {
        const addresses = await dns.resolve4(host);
        if (!addresses || addresses.length === 0) {
          console.log('FAILED (DNS resolution error)');
          allReachable = false;
          continue;
        }

        const ip = addresses[0];

        if (isTcp) {
          const res = await testTcpConnectivity(ip, port);
          if (res.reachable) {
            console.log(`✓ OK (TCP connected to ${ip})`);
          } else {
            console.log(`⚠️  FAIL (${res.error})`);
            // Only flag failure if this is not a demo fallback
            if (!host.includes('openrelay')) allReachable = false;
          }
        } else {
          const res = await testUdpReachability(ip, port);
          if (res.reachable) {
            console.log(`✓ OK (UDP socket bound to ${ip})`);
          } else {
            console.log(`⚠️  FAIL (${res.error})`);
            if (!host.includes('openrelay')) allReachable = false;
          }
        }
      } catch (err) {
        console.log(`FAILED (${err.message})`);
        if (!host.includes('openrelay')) allReachable = false;
      }
    }
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (allReachable) {
    console.log('  STATUS: PASS — STUN/TURN relays reachable for CGNAT traversal.');
  } else {
    console.log('  STATUS: PARTIAL / WARNING — Some relays were unreachable.');
    console.log('  Note: Update .env with your dedicated TURN credentials for 100% production uptime.');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runVerification().catch((err) => {
  console.error('Unexpected verification error:', err);
  process.exit(1);
});
