import type { LoaderFunctionArgs } from '@remix-run/server-runtime';

export function loader({ params }: LoaderFunctionArgs) {
	const id = params.id;
	if (!id || !/^\d{1,20}$/.test(id) || typeof Switch === 'undefined') {
		return new Response(null, { status: 404 });
	}
	try {
		const icon = new Switch.Application(BigInt(id)).icon;
		if (!icon) return new Response(null, { status: 404 });
		return new Response(icon, {
			headers: {
				'Content-Type': 'image/jpeg',
				'Cache-Control': 'private, max-age=86400',
			},
		});
	} catch {
		return new Response(null, { status: 404 });
	}
}
