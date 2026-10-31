---
phase: 1
slug: signaling-cellular-cgnat-relay
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node:test`) |
| **Config file** | `server/package.json` |
| **Quick run command** | `node --test server/tests/signaling.test.js` |
| **Full suite command** | `npm test --prefix server` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test server/tests/signaling.test.js`
- **After every plan wave:** Run `npm test --prefix server`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | STREAM-02 | — | Scaffolds Node project with ws & dotenv dependencies | integration | `test -f server/package.json && test -f server/src/index.js` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | STREAM-02 | T-01-01 | Rejects unauthorized room join requests with missing token | unit | `node --test server/tests/signaling.test.js` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | STREAM-02 | — | Routes SDP and ICE messages strictly between room peers | integration | `node --test server/tests/signaling.test.js` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | STREAM-02 | — | Validates STUN and TURN server credentials configuration | unit | `node --test server/tests/config.test.js` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | STREAM-02 | T-01-02 | Verifies ICE gathering generates relay candidates across CGNAT | integration | `node server/tests/verify-turn.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/package.json` — base server manifest with `ws`, `dotenv`, and test scripts
- [ ] `server/tests/signaling.test.js` — test suite covering connection, rooms, and routing
- [ ] `server/tests/config.test.js` — test suite covering STUN/TURN credential formatting
- [ ] `server/tests/verify-turn.js` — Trickle ICE candidate validator script

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cellular hotspot live traversal | STREAM-02 | Requires live SIM carrier connection | Connect phone via 4G/5G mobile hotspot to signaling server and verify state |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-10-30
