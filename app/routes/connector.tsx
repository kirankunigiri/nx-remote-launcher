import { type ActionFunctionArgs, json } from '@remix-run/server-runtime';

import { connectorService } from '~/lib/connector/service.server';

export async function loader() {
	return json(connectorService.getState());
}

export async function action({ request }: ActionFunctionArgs) {
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		return json({ error: 'JSON request required.' }, { status: 415 });
	}
	let input: Record<string, unknown>;
	try {
		input = await request.json();
	} catch {
		return json({ error: 'Invalid JSON.' }, { status: 400 });
	}
	const reply = await connectorService.handle(input);
	return json(reply.data, { status: reply.status });
}
