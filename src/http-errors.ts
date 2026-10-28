export function isClientDisconnect(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /broken pipe|connection reset|connection closed/i.test(message);
}
