import { expect, test } from 'bun:test';

import { loader } from '../app/routes/icon.$id';

test('serves installed game icons and rejects invalid title IDs', async () => {
	const original = globalThis.Switch;
	const icon = new Uint8Array([255, 216, 255, 217]);
	globalThis.Switch = {
		Application: class {
			constructor(id) { this.id = id; this.icon = icon; }
		},
	};
	try {
		const response = loader({ params: { id: '72057594037927936' } });
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/jpeg');
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(icon);
		expect(loader({ params: { id: '../invalid' } }).status).toBe(404);
	} finally {
		globalThis.Switch = original;
	}
});

test('returns 404 when Switch APIs are unavailable', () => {
	const original = globalThis.Switch;
	globalThis.Switch = undefined;
	try {
		expect(loader({ params: { id: '72057594037927936' } }).status).toBe(404);
	} finally {
		globalThis.Switch = original;
	}
});
