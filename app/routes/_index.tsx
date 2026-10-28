import { Divider } from '@mantine/core';
import type { MetaFunction } from '@remix-run/node';
import { useEffect, useState } from 'react';

import Apps, { type App } from '~/lib/apps/apps';
import Filter from '~/lib/apps/filter';
import Client from '~/lib/client';
import Footer from '~/lib/footer';
import Header from '~/lib/header';

export const meta: MetaFunction = () => {
	return [
		{ title: 'NX Remote Launcher' },
		{ name: 'description', content: 'NX Remote Launcher' },
	];
};

export default function Index() {
	const [apps, setApps] = useState<App[]>([]);
	const [error, setError] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		const key = 'nxrl-apps:v1';
		try {
			const saved = JSON.parse(localStorage.getItem(key) || 'null');
			if (Array.isArray(saved?.apps)) {
				setApps(saved.apps);
			}
		} catch {}
		fetch('/apps', { cache: 'no-store', signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				return await response.json() as { apps: App[] };
			})
			.then((result) => {
				if (!Array.isArray(result.apps)) {
					throw new Error('Invalid game list');
				}
				setApps(result.apps);
				try {
					localStorage.setItem(key, JSON.stringify({ apps: result.apps }));
				} catch {}
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError(true);
				}
			});
		return () => controller.abort();
	}, []);

	return (
		<Client>
			<div className="flex h-dvh w-dvw flex-col items-center">
				<Header />
				<Filter />

				{/* Body */}
				<div className="flex w-full flex-1 flex-col overflow-y-scroll">

					{/* App Grid */}
					{apps.length === 0 && <p className="p-4 text-center text-sm">{error ? 'Could not load games.' : 'Loading games...'}</p>}
					<Apps apps={apps} />

					<Divider />
					<Footer />
				</div>
			</div>
		</Client>
	);
}
