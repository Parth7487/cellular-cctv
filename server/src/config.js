import dotenv from 'dotenv';
dotenv.config();

/**
 * Returns formatted WebRTC ICE servers configuration including STUN and TURN relays.
 * Configured specifically to punch through cellular Carrier-Grade NAT (CGNAT)
 * with UDP 3478 and TURNS over TCP port 443.
 *
 * @returns {Array<{ urls: string|string[], username?: string, credential?: string }>}
 */
export function getIceServers() {
  const stunUrlsEnv = process.env.STUN_URLS;
  const stunServers = stunUrlsEnv
    ? stunUrlsEnv.split(',').map((url) => url.trim())
    : [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ];

  const iceServers = [
    {
      urls: stunServers,
    },
  ];

  const turnUrl = process.env.TURN_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    const cleanUrl = turnUrl.replace(/^(turn:|turns:)/, '').replace(/\?.*$/, '');
    const [host, port = '3478'] = cleanUrl.split(':');

    iceServers.push(
      {
        urls: [
          `turn:${host}:${port}?transport=udp`,
          `turn:${host}:${port}?transport=tcp`,
        ],
        username: turnUsername,
        credential: turnCredential,
      },
      {
        urls: `turns:${host}:443?transport=tcp`,
        username: turnUsername,
        credential: turnCredential,
      }
    );
  } else {
    // Development fallback: OpenRelay (Metered.ca free tier for initial testing)
    iceServers.push({
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    });
  }

  return iceServers;
}
