import { expect, test } from 'bun:test';

import { isClientDisconnect } from '../src/http-errors';

test('recognizes disconnected clients without hiding other failures', () => {
	expect(isClientDisconnect(new Error('Broken pipe'))).toBe(true);
	expect(isClientDisconnect(new Error('Connection reset by peer'))).toBe(true);
	expect(isClientDisconnect(new Error('Connection closed'))).toBe(true);
	expect(isClientDisconnect(new Error('Request handler failed'))).toBe(false);
	expect(isClientDisconnect(null)).toBe(false);
});
