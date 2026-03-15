import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { createDomainGateway } from '../server/gateway.ts';

const originalKeys = process.env.WORLDMONITOR_VALID_KEYS;
const originalSelfHosted = process.env.SELF_HOSTED_OPEN;

afterEach(() => {
  if (originalKeys == null) delete process.env.WORLDMONITOR_VALID_KEYS;
  else process.env.WORLDMONITOR_VALID_KEYS = originalKeys;
  if (originalSelfHosted == null) delete process.env.SELF_HOSTED_OPEN;
  else process.env.SELF_HOSTED_OPEN = originalSelfHosted;
});

describe('premium stock gateway enforcement', () => {
  it('requires a World Monitor key for premium stock RPCs even from trusted browser origins', async () => {
    // Ensure SELF_HOSTED_OPEN is not set so premium enforcement is active
    delete process.env.SELF_HOSTED_OPEN;
    const handler = createDomainGateway([
      {
        method: 'GET',
        path: '/api/market/v1/analyze-stock',
        handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      },
      {
        method: 'GET',
        path: '/api/market/v1/list-market-quotes',
        handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      },
    ]);

    process.env.WORLDMONITOR_VALID_KEYS = 'real-key-123';

    const premiumBlocked = await handler(new Request('https://worldmonitor.app/api/market/v1/analyze-stock?symbol=AAPL', {
      headers: { Origin: 'https://worldmonitor.app' },
    }));
    assert.equal(premiumBlocked.status, 401);

    const premiumAllowed = await handler(new Request('https://worldmonitor.app/api/market/v1/analyze-stock?symbol=AAPL', {
      headers: {
        Origin: 'https://worldmonitor.app',
        'X-WorldMonitor-Key': 'real-key-123',
      },
    }));
    assert.equal(premiumAllowed.status, 200);

    const publicAllowed = await handler(new Request('https://worldmonitor.app/api/market/v1/list-market-quotes?symbols=AAPL', {
      headers: { Origin: 'https://worldmonitor.app' },
    }));
    assert.equal(publicAllowed.status, 200);
  });

  it('bypasses premium key check when SELF_HOSTED_OPEN=true', async () => {
    process.env.SELF_HOSTED_OPEN = 'true';
    const handler = createDomainGateway([
      {
        method: 'GET',
        path: '/api/market/v1/analyze-stock',
        handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      },
    ]);

    process.env.WORLDMONITOR_VALID_KEYS = 'real-key-123';

    const premiumOpen = await handler(new Request('https://worldmonitor.app/api/market/v1/analyze-stock?symbol=AAPL', {
      headers: { Origin: 'https://worldmonitor.app' },
    }));
    assert.equal(premiumOpen.status, 200, 'Premium RPC should be open when SELF_HOSTED_OPEN=true');
  });

  it('does not bypass premium check when SELF_HOSTED_OPEN is set to non-true value', async () => {
    process.env.SELF_HOSTED_OPEN = 'false';
    const handler = createDomainGateway([
      {
        method: 'GET',
        path: '/api/market/v1/analyze-stock',
        handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      },
    ]);

    process.env.WORLDMONITOR_VALID_KEYS = 'real-key-123';

    const premiumStillBlocked = await handler(new Request('https://worldmonitor.app/api/market/v1/analyze-stock?symbol=AAPL', {
      headers: { Origin: 'https://worldmonitor.app' },
    }));
    assert.equal(premiumStillBlocked.status, 401, 'Premium RPC should remain gated when SELF_HOSTED_OPEN is not exactly "true"');
  });
});
