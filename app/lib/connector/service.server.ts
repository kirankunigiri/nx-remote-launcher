import { createConnectorGames, parseConnectorEndpoint } from '~/lib/connector/games';

const CONFIG_DIR = 'sdmc:/switch/NXRemoteLauncher';
const CONFIG_FILE = `${CONFIG_DIR}/connector.json`;

interface ConnectorConfig {
	endpoint: string
	token: string
}

interface PendingPair {
	endpoint: string
	code: string
	pollToken: string
	approveUrl: string
	expiresAt: number
}

interface ServiceReply {
	status: number
	data: Record<string, unknown>
}

class ConnectorService {
	private pendingPair: PendingPair | null = null;
	private approvedToken: string | null = null;

	getState() {
		const config = this.readConfig();
		return {
			available: typeof Switch !== 'undefined',
			paired: Boolean(config),
			endpoint: config?.endpoint || null,
			pairing: this.publicPair(),
		};
	}

	async handle(input: Record<string, unknown>): Promise<ServiceReply> {
		if (typeof Switch === 'undefined') return { status: 501, data: { error: 'Available only on Switch.' } };
		try {
			switch (input.operation) {
				case 'pair-start': return await this.startPair(input.endpoint);
				case 'pair-restart': {
					const removed = this.disconnect();
					return removed.status === 200 ? await this.startPair(input.endpoint) : removed;
				}
				case 'pair-poll': return await this.pollPair();
				case 'disconnect': return this.disconnect();
				case 'sync': return await this.syncGames();
				default: return { status: 400, data: { error: 'Unknown operation.' } };
			}
		} catch {
			return { status: 502, data: { error: 'Connector request failed.' } };
		}
	}

	private readConfig(): ConnectorConfig | null {
		if (typeof Switch === 'undefined') return null;
		try {
			const buffer = Switch.readFileSync(CONFIG_FILE);
			if (!buffer || buffer.byteLength > 8192) return null;
			const config: unknown = JSON.parse(new TextDecoder().decode(buffer));
			if (!config || typeof config !== 'object') return null;
			const { endpoint, token } = config as { endpoint?: unknown, token?: unknown };
			const validEndpoint = typeof endpoint === 'string' && parseConnectorEndpoint(endpoint) === endpoint;
			const validToken = typeof token === 'string' && token.length > 0 && token.length <= 4096;
			return validEndpoint && validToken
				? { endpoint, token }
				: null;
		} catch {
			return null;
		}
	}

	private saveConfig(endpoint: string, token: string): void {
		Switch.mkdirSync(CONFIG_DIR);
		Switch.writeFileSync(CONFIG_FILE, JSON.stringify({ endpoint, token }));
		if (this.readConfig()?.token !== token) throw new Error('Could not verify connector token.');
	}

	private disconnect(): ServiceReply {
		try {
			if (this.readConfig()) Switch.removeSync(CONFIG_FILE);
			if (this.readConfig()) return { status: 507, data: { error: 'Could not remove the saved connection.' } };
		} catch {
			return { status: 507, data: { error: 'Could not remove the saved connection.' } };
		}
		this.pendingPair = null;
		this.approvedToken = null;
		return { status: 200, data: { paired: false, endpoint: null, pairing: null } };
	}

	private async startPair(value: unknown): Promise<ServiceReply> {
		if (this.readConfig()) return { status: 409, data: { error: 'Disconnect before pairing again.' } };
		const endpoint = typeof value === 'string' ? parseConnectorEndpoint(value) : null;
		if (!endpoint) return { status: 400, data: { error: 'Enter an HTTPS connector URL ending in /api/connect/slug.' } };
		const response = await this.request(endpoint, '/pair', { deviceName: 'Nintendo Switch' }, null, 20000);
		if (!response.ok) return { status: response.status, data: { error: 'Pairing was rejected.' } };
		const data = response.data;
		const invalidCode = typeof data.code !== 'string' || typeof data.pollToken !== 'string';
		const invalidApproval = typeof data.approveUrl !== 'string';
		if (invalidCode || invalidApproval) {
			return { status: 502, data: { error: 'Invalid pairing response.' } };
		}
		const code = data.code as string;
		const pollToken = data.pollToken as string;
		const approvalLink = data.approveUrl as string;
		const approveUrl = new URL(approvalLink);
		const serverExpiry = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : NaN;
		const serverDate = Date.parse(response.date || '');
		const duration = Number.isFinite(serverExpiry) && Number.isFinite(serverDate)
			? serverExpiry - serverDate
			: 600000;
		const expiresAt = Date.now() + duration;
		if (approveUrl.origin !== new URL(endpoint).origin || duration <= 0) {
			return { status: 502, data: { error: 'Invalid approval URL or expiry.' } };
		}
		this.pendingPair = { endpoint, code, pollToken, approveUrl: approvalLink, expiresAt };
		this.approvedToken = null;
		return { status: 200, data: { paired: false, pairing: this.publicPair() } };
	}

	private publicPair() {
		if (!this.pendingPair || Date.now() >= this.pendingPair.expiresAt) return null;
		return {
			code: this.pendingPair.code,
			approveUrl: this.pendingPair.approveUrl,
			expiresAt: this.pendingPair.expiresAt,
		};
	}

	private async pollPair(): Promise<ServiceReply> {
		const pair = this.pendingPair;
		if (!pair || Date.now() >= pair.expiresAt) {
			this.pendingPair = null;
			return { status: 200, data: { status: 'expired' } };
		}
		if (!this.approvedToken) {
			const response = await this.request(pair.endpoint, '/pair/poll', { pollToken: pair.pollToken }, null, 20000);
			if (!response.ok) return { status: response.status, data: { error: 'Pairing check failed.' } };
			if (response.data.status === 'pending') return { status: 200, data: { status: 'pending' } };
			if (response.data.status === 'expired') {
				this.pendingPair = null;
				return { status: 200, data: { status: 'expired' } };
			}
			if (response.data.status !== 'approved' || typeof response.data.token !== 'string') {
				return { status: 502, data: { error: 'Invalid pairing status.' } };
			}
			this.approvedToken = response.data.token;
		}
		try {
			this.saveConfig(pair.endpoint, this.approvedToken);
			this.pendingPair = null;
			this.approvedToken = null;
			return { status: 200, data: { status: 'approved', paired: true, endpoint: pair.endpoint } };
		} catch {
			return { status: 507, data: { error: 'Could not save the connection. Try again without closing the app.' } };
		}
	}

	private async syncGames(): Promise<ServiceReply> {
		const config = this.readConfig();
		if (!config) return { status: 401, data: { error: 'Pairing required.', paired: false } };
		const apps: { id: string, name: string }[] = [];
		for (const app of Switch.Application) apps.push({ id: app.id.toString(), name: app.name });
		const games = createConnectorGames(apps);
		if (!games.length) return { status: 409, data: { error: 'No installed games found.' } };
		const response = await this.request(config.endpoint, '/sync', { games, complete: true }, config.token, 120000);
		if (response.status === 401) {
			const removed = this.disconnect();
			return removed.status === 200
				? { status: 401, data: { error: 'Connection expired. Pair again.', paired: false } }
				: removed;
		}
		if (!response.ok) return { status: response.status, data: { error: 'Sync was rejected.' } };
		const data = response.data;
		return {
			status: 200,
			data: {
				submitted: games.length,
				added: typeof data.added === 'number' ? data.added : 0,
				existing: typeof data.existing === 'number' ? data.existing : 0,
				absent: typeof data.absent === 'number' ? data.absent : 0,
				unknown: Array.isArray(data.unknown) ? data.unknown.length : 0,
			},
		};
	}

	private async request(endpoint: string, path: string, body: Record<string, unknown>, token: string | null, timeout: number) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);
		try {
			const response = await fetch(`${endpoint}${path}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept-Encoding': 'identity',
					'Connection': 'close',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			});
			const text = await this.readBody(response);
			let data: Record<string, unknown> = {};
			try {
				const parsed: unknown = JSON.parse(text);
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
			} catch {
				if (response.ok) throw new Error('Invalid JSON response.');
			}
			return { ok: response.ok, status: response.status, data, date: response.headers.get('date') };
		} finally {
			clearTimeout(timer);
		}
	}

	private async readBody(response: Awaited<ReturnType<typeof fetch>>): Promise<string> {
		const reader = response.body?.getReader();
		if (!reader) return await response.text();
		const decoder = new TextDecoder();
		const header = response.headers.get('content-length');
		const length = header && /^\d+$/.test(header) ? Number(header) : null;
		let body = '';
		let size = 0;
		try {
			for (;;) {
				let timer: ReturnType<typeof setTimeout> | undefined;
				let result: ReadableStreamReadResult<Uint8Array>;
				try {
					result = await Promise.race([
						reader.read(),
						new Promise<never>((_, reject) => {
							timer = setTimeout(() => reject(new Error('Response timed out.')), 20000);
						}),
					]);
				} finally {
					if (timer !== undefined) clearTimeout(timer);
				}
				if (result.done) break;
				size += result.value.byteLength;
				if (size > 262144) throw new Error('Response too large.');
				body += decoder.decode(result.value, { stream: true });
				if (length !== null && size >= length) break;
				try {
					JSON.parse(body);
					break;
				} catch {
				}
			}
			body += decoder.decode();
			return body;
		} finally {
			void reader.cancel().catch(() => undefined);
		}
	}
}

export const connectorService = new ConnectorService();
