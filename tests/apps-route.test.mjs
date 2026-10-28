import { expect, test } from 'bun:test';

test('shares concurrent inventory reads and keeps the result in memory', async () => {
	const original = globalThis.Switch;
	let reads = 0;
	globalThis.Switch = {
		Application: {
			*[Symbol.iterator]() {
				reads++;
				yield { name: 'Example Game', version: '1.0.0', author: 'Example', id: 1n };
			},
		},
	};
	try {
		const { loader } = await import('../app/routes/apps');
		const [firstResponse, secondResponse] = await Promise.all([loader(), loader()]);
		const first = await firstResponse.json();
		const second = await secondResponse.json();
		const third = await (await loader()).json();
		expect(first.apps).toEqual([{ name: 'Example Game', version: '1.0.0', author: 'Example', id: '1' }]);
		expect(first.cacheHit).toBe(false);
		expect(second.cacheHit).toBe(false);
		expect(third.cacheHit).toBe(true);
		expect(reads).toBe(1);
	} finally {
		globalThis.Switch = original;
	}
});
