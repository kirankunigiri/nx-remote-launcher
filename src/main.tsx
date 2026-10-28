import * as http from '@nx.js/http';
import {
	createRequestHandler,
	type ServerBuild,
} from '@remix-run/server-runtime';
import { Image, Rect, Text } from 'react-tela';
import { render } from 'react-tela/render';

import * as build from '../build/server/index.js';
import { isClientDisconnect } from './http-errors';

let serverBuild = build as unknown as ServerBuild;

let requestHandler: http.ServerHandler;
const staticHandler = http.createStaticFileHandler('romfs:/public/');

declare const DEV_MODE: boolean;
if (DEV_MODE) {
	requestHandler = (req: Request) => createRequestHandler(serverBuild)(req);
} else {
	requestHandler = createRequestHandler(build as unknown as ServerBuild);
}

const port = 8080;
const handleRequest = http.createServerHandler(async (req) => {
	if (
		DEV_MODE
		&& req.method === 'POST'
		&& new URL(req.url).pathname === '/__dev'
	) {
		const module = { exports: serverBuild };
		new Function('module', await req.text())(module);
		serverBuild = module.exports;
		console.log(`Dev server updated: ${new Date()}`);
		return new Response(null, { status: 202 });
	}
	let res = await staticHandler(req);
	if (!res) res = await requestHandler(req);
	return res;
});

Switch.listen({
	port,
	accept(event) {
		void handleRequest(event).catch((error: unknown) => {
			if (isClientDisconnect(error)) return;
			console.error('HTTP connection failed:', error);
		});
	},
});

// Prevent auto-lock / screen dimming
Switch.setMediaPlaybackState(true);
addEventListener('unload', () => {
	Switch.setMediaPlaybackState(false);
});

const { ip } = Switch.networkInfo();
const url = `http://${ip}:${port}`;

const QR_CODE_SIZE = 300;
const SCREEN_WIDTH = screen.width;
const SCREEN_HEIGHT = screen.height;

function App() {
	const qrUrl = `https://api.dub.co/qr?url=${encodeURIComponent(url)}`;

	return (
		<>
			<Rect
				fill="#2D2D2D"
				width={SCREEN_WIDTH}
				height={SCREEN_HEIGHT}
				x={0}
				y={0}
			/>

			{/* Title */}
			<Text
				fill="white"
				x={20}
				y={40}
				fontSize={28}
				fontWeight="bold"
			>
				NX Remote Launcher
			</Text>

			{/* QR Code */}
			{qrUrl && (
				<Image
					src={qrUrl}
					x={(SCREEN_WIDTH - QR_CODE_SIZE) / 2}
					y={(SCREEN_HEIGHT - QR_CODE_SIZE) / 2 - 50}
					width={QR_CODE_SIZE}
					height={QR_CODE_SIZE}
				/>
			)}

			{/* Instructions */}
			<Text
				fill="white"
				x={(SCREEN_WIDTH) / 2}
				y={(SCREEN_HEIGHT + QR_CODE_SIZE) / 2}
				fontSize={28}
				textAlign="center"
			>
				Scan the QR Code
			</Text>

			<Text
				fill="white"
				x={(SCREEN_WIDTH) / 2 - 230}
				y={(SCREEN_HEIGHT + QR_CODE_SIZE) / 2 + 40}
				fontSize={20}
			>
				or open
			</Text>

			<Rect
				fill="#000000"
				x={(SCREEN_WIDTH) / 2 - 140}
				y={(SCREEN_HEIGHT + QR_CODE_SIZE) / 2 + 35}
				width={255}
				height={32}
			/>

			<Text
				fill="white"
				x={(SCREEN_WIDTH) / 2 - 130}
				y={(SCREEN_HEIGHT + QR_CODE_SIZE) / 2 + 40}
				fontSize={20}
			>
				{url}
			</Text>

			<Text
				fill="white"
				x={(SCREEN_WIDTH) / 2 + 120}
				y={(SCREEN_HEIGHT + QR_CODE_SIZE) / 2 + 40}
				fontSize={20}
			>
				in your browser.
			</Text>

			{/* Footer */}
			<Text
				fill="#808080"
				x={20}
				y={SCREEN_HEIGHT - 30}
				fontSize={18}
			>
				v1.0.1
			</Text>

			<Text
				fill="#808080"
				x={SCREEN_WIDTH - 10}
				y={SCREEN_HEIGHT - 30}
				fontSize={18}
				textAlign="right"
			>
				Created by Kiran Kunigiri
			</Text>
		</>
	);
}

if (DEV_MODE) {
	console.log(`HTTP server listening at: ${url}`);
	console.log();
	console.log('\x1B[1m\x1B[33mDEVELOPMENT MODE\x1B[39m\x1B[22m');
	console.log(
		`\x1B[33mRun the following command on your local machine:\x1B[39m`,
	);
	console.log();
	console.log(`  $ \x1B[36mnpm run dev ${url}\x1B[39m`);
	console.log();
} else {
	render(<App />, screen);
}
