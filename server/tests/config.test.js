import test from 'node:test';
import assert from 'node:assert/strict';
import { getIceServers } from '../src/config.js';

test('ICE Server Configuration - STUN and TURN formatting', async (t) => {
  await t.test('Default configuration returns STUN and OpenRelay fallback', () => {
    const servers = getIceServers();
    assert.ok(Array.isArray(servers));
    assert.ok(servers.length >= 2);

    // STUN check
    const stunEntry = servers.find((s) =>
      Array.isArray(s.urls)
        ? s.urls.some((u) => u.startsWith('stun:'))
        : s.urls.startsWith('stun:')
    );
    assert.ok(stunEntry, 'Expected at least one STUN server entry');

    // TURN check
    const turnEntry = servers.find((s) =>
      Array.isArray(s.urls)
        ? s.urls.some((u) => u.startsWith('turn:'))
        : s.urls.startsWith('turn:')
    );
    assert.ok(turnEntry, 'Expected at least one TURN server entry');
    assert.ok(turnEntry.username, 'Expected TURN username');
    assert.ok(turnEntry.credential, 'Expected TURN credential');
  });

  await t.test('Custom TURN environment variables generate TCP 443 fallback entry', () => {
    const oldEnv = { ...process.env };
    try {
      process.env.TURN_URL = 'turn:my-relay.domain.com:3478';
      process.env.TURN_USERNAME = 'user123';
      process.env.TURN_CREDENTIAL = 'pass123';

      const servers = getIceServers();
      const turnsTcpEntry = servers.find((s) =>
        typeof s.urls === 'string'
          ? s.urls.includes('turns:') && s.urls.includes('443') && s.urls.includes('transport=tcp')
          : Array.isArray(s.urls) && s.urls.some((u) => u.includes('turns:') && u.includes('443'))
      );

      assert.ok(turnsTcpEntry, 'Expected a TURNS TCP 443 entry for carrier CGNAT bypass');
      assert.equal(turnsTcpEntry.username, 'user123');
      assert.equal(turnsTcpEntry.credential, 'pass123');
    } finally {
      process.env = oldEnv;
    }
  });
});
