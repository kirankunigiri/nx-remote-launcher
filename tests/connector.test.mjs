import { expect, test } from 'bun:test';

import { createConnectorGames, parseConnectorEndpoint } from '../app/lib/connector/games';
import { connectorService } from '../app/lib/connector/service.server';

test('accepts only HTTPS connector endpoints', () => {
	expect(parseConnectorEndpoint('https://games.example/api/connect/my-switch/')).toBe('https://games.example/api/connect/my-switch');
	expect(parseConnectorEndpoint('http://games.example/api/connect/my-switch')).toBeNull();
	expect(parseConnectorEndpoint('https://user:password@games.example/api/connect/my-switch')).toBeNull();
	expect(parseConnectorEndpoint('https://games.example/api/connect/my-switch?token=secret')).toBeNull();
	expect(parseConnectorEndpoint('https://games.example/other')).toBeNull();
});

test('sends only installed base games once', () => {
	const id = BigInt('0x0100152000022000').toString();
	const update = BigInt('0x0100152000022800').toString();
	expect(createConnectorGames([
		{ id, name: 'Example Game' },
		{ id, name: 'Example Game' },
		{ id: update, name: 'Example Game Update' },
		{ id: 'invalid', name: 'Invalid' },
	])).toEqual([{ id: '0100152000022000', name: 'Example Game' }]);
});

test('pairs, syncs, and disconnects without exposing a token', async () => {
	const files = new Map();
	const requests = [];
	let rejectSync = false;
	const originalSwitch = globalThis.Switch;
	const originalFetch = globalThis.fetch;
	globalThis.Switch = {
		Application: [{ id: BigInt('0x0100152000022000'), name: 'Example Game' }],
		readFileSync: path => {
			if (!files.has(path)) throw new Error('Missing file');
			return files.get(path);
		},
		writeFileSync: (path, value) => files.set(path, new TextEncoder().encode(value)),
		removeSync: path => files.delete(path),
		mkdirSync: () => {},
	};
	globalThis.fetch = async (url, init) => {
		requests.push({ url, init });
		if (url.endsWith('/pair')) {
			const body = JSON.stringify({
			code: 'ABCD-1234',
			pollToken: 'private-poll-token',
			approveUrl: 'https://games.example/connectors/approve?code=ABCD-1234',
			expiresAt: new Date(Date.now() - 60000).toISOString(),
			});
			return new Response(new ReadableStream({
				start(controller) { controller.enqueue(new TextEncoder().encode(body)); },
			}), { headers: { Date: new Date(Date.now() - 660000).toUTCString() } });
		}
		if (url.endsWith('/pair/poll')) return Response.json({ status: 'approved', token: 'private-device-token' });
		if (url.endsWith('/sync')) return rejectSync
			? Response.json({ detail: 'Unknown device token' }, { status: 401 })
			: Response.json({ added: 1, existing: 0, absent: 0, unknown: [] });
		throw new Error('Unexpected request');
	};
	try {
		expect(connectorService.getState().paired).toBe(false);
		const pair = await connectorService.handle({ operation: 'pair-start', endpoint: 'https://games.example/api/connect/my-switch' });
		expect(pair.status).toBe(200);
		expect(pair.data.pairing.code).toBe('ABCD-1234');
		expect(JSON.parse(requests[0].init.body)).toEqual({ deviceName: 'Nintendo Switch' });
		expect(JSON.stringify(pair.data)).not.toContain('private-poll-token');
		const approval = await connectorService.handle({ operation: 'pair-poll' });
		expect(JSON.parse(requests[1].init.body)).toEqual({ pollToken: 'private-poll-token' });
		expect(approval.data.paired).toBe(true);
		expect(JSON.stringify(approval.data)).not.toContain('private-device-token');
		const synced = await connectorService.handle({ operation: 'sync' });
		expect(synced.data).toEqual({ submitted: 1, added: 1, existing: 0, absent: 0, unknown: 0 });
		expect(JSON.parse(requests[2].init.body)).toEqual({
			games: [{ id: '0100152000022000', name: 'Example Game' }], complete: true,
		});
		expect(requests[2].init.headers.Authorization).toBe('Bearer private-device-token');
		const again = await connectorService.handle({ operation: 'pair-restart', endpoint: 'https://games.example/api/connect/my-switch' });
		expect(again.data.pairing.code).toBe('ABCD-1234');
		expect(files.size).toBe(0);
		await connectorService.handle({ operation: 'pair-poll' });
		const removed = await connectorService.handle({ operation: 'disconnect' });
		expect(removed.data.paired).toBe(false);
		expect(files.size).toBe(0);
		await connectorService.handle({ operation: 'pair-start', endpoint: 'https://games.example/api/connect/my-switch' });
		await connectorService.handle({ operation: 'pair-poll' });
		rejectSync = true;
		const expired = await connectorService.handle({ operation: 'sync' });
		expect(expired.status).toBe(401);
		expect(connectorService.getState().paired).toBe(false);
	} finally {
		globalThis.Switch = originalSwitch;
		globalThis.fetch = originalFetch;
	}
});
