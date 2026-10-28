import { Alert, Button, Modal, Space, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';

interface Pairing {
	code: string
	approveUrl: string
	expiresAt: number
}

interface ConnectorState {
	available: boolean
	paired: boolean
	endpoint: string | null
	pairing: Pairing | null
}

interface SyncResult {
	submitted: number
	added: number
	existing: number
	absent: number
	unknown: number
}

function ConnectorControl() {
	const [opened, { open, close }] = useDisclosure(false);
	const [state, setState] = useState<ConnectorState | null>(null);
	const [endpoint, setEndpoint] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [result, setResult] = useState<SyncResult | null>(null);
	const [poll, setPoll] = useState(0);

	useEffect(() => {
		if (!opened) return;
		void fetch('/connector').then(response => response.json()).then((raw) => {
			const data = raw as ConnectorState;
			setState(data);
			if (data.endpoint) setEndpoint(data.endpoint);
		}).catch(() => setError('Could not read the connector state.'));
	}, [opened]);

	useEffect(() => {
		if (!opened || !state?.pairing) return;
		let active = true;
		const timer = window.setTimeout(() => {
			void fetch('/connector', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operation: 'pair-poll' }),
			}).then(async (response) => {
				const data = await response.json() as { error?: string, status?: string, endpoint?: string };
				if (!active) return;
				if (!response.ok) {
					setError(data.error || 'Pairing check failed.');
					setState(current => current ? { ...current, pairing: null } : null);
				} else if (data.status === 'approved') {
					setState(current => current ? { ...current, paired: true, endpoint: data.endpoint || null, pairing: null } : null);
				} else if (data.status === 'expired') {
					setError('The pairing code expired. Create another one.');
					setState(current => current ? { ...current, pairing: null } : null);
				} else {
					setPoll(value => value + 1);
				}
			}).catch(() => {
				if (active) setPoll(value => value + 1);
			});
		}, 5000);
		return () => {
			active = false;
			window.clearTimeout(timer);
		};
	}, [opened, state?.pairing, poll]);

	async function perform(operation: string) {
		setBusy(true);
		setError('');
		setResult(null);
		try {
			const response = await fetch('/connector', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operation, endpoint }),
			});
			const data = await response.json() as Record<string, unknown> & { error?: string };
			if (!response.ok) {
				setError(data.error || 'Connector request failed.');
				return;
			}
			if (operation === 'sync') {
				setResult(data as unknown as SyncResult);
			} else {
				setState(current => current
					? {
						...current,
						paired: Boolean(data.paired),
						endpoint: typeof data.endpoint === 'string' ? data.endpoint : null,
						pairing: data.pairing as Pairing | null || null,
					}
					: null);
			}
		} catch {
			setError('Could not reach NX Remote Launcher.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Button size="xs" variant="subtle" onClick={open}>Connect</Button>
			<Modal opened={opened} onClose={close} title="External connector" centered>
				{!state && <p>Loading...</p>}
				{state && !state.available && <Alert color="yellow">Available only on Switch.</Alert>}
				{state?.available && (
					<>
						<TextInput
							label="Connector URL"
							placeholder="https://example.com/api/connect/my-switch"
							value={endpoint}
							onChange={event => setEndpoint((event.target as unknown as { value: string }).value)}
							disabled={state.paired || busy}
						/>
						<Space h="md" />
						{state.paired
							? (
								<>
									<div className="flex flex-wrap gap-2">
										<Button loading={busy} onClick={() => void perform('sync')}>Sync installed games</Button>
										<Button variant="light" disabled={busy} onClick={() => void perform('pair-restart')}>Pair again</Button>
										<Button color="red" variant="subtle" disabled={busy} onClick={() => void perform('disconnect')}>Disconnect</Button>
									</div>
									<p className="mt-2 text-xs">A full sync follows the connector setting for games no longer installed.</p>
								</>
							)
							: (
								<Button loading={busy} disabled={Boolean(state.pairing)} onClick={() => void perform('pair-start')}>Create pairing code</Button>
							)}
						{state.pairing && (
							<Alert color="blue" title="Approve this device" mt="md">
								<p>Code: <strong>{state.pairing.code}</strong></p>
								<a href={state.pairing.approveUrl} target="_blank" rel="noreferrer">Open approval page</a>
							</Alert>
						)}
						{result && (
							<Alert color="green" title="Sync complete" mt="md">
								Submitted: {result.submitted} · added: {result.added} · existing: {result.existing} · absent: {result.absent} · unknown: {result.unknown}
							</Alert>
						)}
						{error && <Alert color="red" title="Connector error" mt="md">{error}</Alert>}
					</>
				)}
			</Modal>
		</>
	);
}

export default ConnectorControl;
