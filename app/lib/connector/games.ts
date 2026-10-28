export interface ConnectorGame {
	id: string
	name: string
}

export function createConnectorGames(apps: { id: string, name: string }[]): ConnectorGame[] {
	const games = new Map<string, ConnectorGame>();
	for (const app of apps) {
		if (!/^\d+$/.test(app.id)) continue;
		const id = BigInt(app.id).toString(16).toUpperCase().padStart(16, '0');
		const name = app.name.trim();
		if (!/^0100[0-9A-F]{9}000$/.test(id) || !name) continue;
		games.set(id, { id, name });
	}
	return [...games.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function parseConnectorEndpoint(value: string): string | null {
	try {
		const url = new URL(value.trim());
		if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
		if (!/^\/api\/connect\/[a-z0-9][a-z0-9-]{1,59}\/?$/.test(url.pathname)) return null;
		return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
	} catch {
		return null;
	}
}
