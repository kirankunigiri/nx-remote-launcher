import { json } from '@remix-run/server-runtime';

import type { App } from '~/lib/apps/apps';
import testApps from '~/lib/test/apps.json';

let cached: App[] | null = null;
let pending: Promise<App[]> | null = null;

function readInstalledApps(): App[] {
	const apps: App[] = [];
	if (typeof Switch !== 'undefined') {
		for (const app of Switch.Application) {
			apps.push({
				name: app.name,
				version: app.version,
				author: app.author,
				id: app.id.toString(),
			});
		}
	} else {
		for (const app of testApps) apps.push(app);
	}
	return apps;
}

export async function loader() {
	if (cached) return json({ apps: cached, cacheHit: true }, { headers: { 'Cache-Control': 'no-store' } });
	if (!pending) pending = Promise.resolve().then(readInstalledApps);
	try {
		cached = await pending;
		return json({ apps: cached, cacheHit: false }, { headers: { 'Cache-Control': 'no-store' } });
	} finally {
		pending = null;
	}
}
