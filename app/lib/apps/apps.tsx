import { observable } from '@legendapp/state';
import { use$ } from '@legendapp/state/react';
import { Box, Button, Modal, Space, VisuallyHidden } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { GameUS, getQueriedGamesAmerica, QueriedGameUS } from 'nintendo-switch-eshop';
import { useEffect, useState } from 'react';
import { LuPlay, LuTags, LuUsers, LuYoutube } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';

import { PLAYER_COUNT_MAP } from '~/lib/apps/filter';
import { useGameInfo } from '~/lib/hooks/use-game-info';

interface View {
	search: string
	playerRangeStart: number
	playerRangeEnd: number
	genreList: string[]
	selectedGenres: string[]
	selectedApp: App | null
}

export const view$ = observable<View>({
	search: '',
	playerRangeStart: 0,
	playerRangeEnd: 6,
	genreList: [],
	selectedGenres: [],
	selectedApp: null,
});

export interface App {
	name: string
	version: string
	id: string
	author: string
}

interface AppsProps {
	apps: App[]
}

function Apps({ apps }: AppsProps) {
	const search = use$(view$.search);
	const filteredApps = apps.filter(app => app.name.toLowerCase().includes(search.toLowerCase()));
	const selectedApp = use$(view$.selectedApp);
	const { data: gameInfo } = useGameInfo(selectedApp?.name);

	const handleLaunch = async (e: React.MouseEvent) => {
		e.preventDefault();

		try {
			const response = await fetch('/launch', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ appId: selectedApp?.id }),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
		} catch (error) {
			console.error('Failed to launch app:', error);
		}
	};

	return (
		<div className="grid w-full grid-cols-[repeat(auto-fit,minmax(80px,1fr))] gap-2 p-2 pt-[44px]">
			{filteredApps.map(app => (
				<AppItem key={app.id} app={app} />
			))}
			<Modal opened={!!selectedApp} onClose={() => view$.selectedApp.set(null)} title={selectedApp?.name} centered size="xl">
				<div className="space-y-4">

					{/* Header Image */}
					{gameInfo?.horizontalHeaderImage && (
						<img src={gameInfo?.horizontalHeaderImage} alt={selectedApp?.name} className="size-full object-cover" />
					)}

					<div className="flex flex-col gap-2">

						{/* Metadata */}
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<LuUsers size={20} />
								<span className="text-sm capitalize"><b>Players:</b> {gameInfo?.numOfPlayers || 'Unknown'}</span>
							</div>
							<div className="flex items-center gap-2">
								<LuTags size={20} />
								<span className="text-sm capitalize"><b>Genres:</b> {gameInfo?.genres?.join(', ') || 'Unknown'}</span>
							</div>
						</div>

						{/* Actions */}
						{selectedApp && (
							<>
								<Button
									leftSection={<LuYoutube size={24} />}
									component="a"
									href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${selectedApp.name} nintendo switch trailer`)}`}
									target="_blank"
									rel="noopener noreferrer"
									color="red"
									className="inline-block rounded px-4 py-2 text-white"
								>
									Watch Trailer
								</Button>
								<Button
									leftSection={<LuPlay size={24} />}
									color="blue"
									onClick={handleLaunch}
								>
									Launch Game
								</Button>
							</>
						)}
					</div>
				</div>
			</Modal>
		</div>
	);
}

const extractPlayerCount = (game: QueriedGameUS | null): string => {
	const playerString = game?.numOfPlayers || game?.playerCount;
	if (!playerString) return '?';
	const match = playerString.match(/\d+/);
	return match ? match[0] : '?';
};

const cleanHex = (decimal: bigint) => {
	return BigInt(decimal).toString(16).padStart(16, '0').toUpperCase();
};

const IMAGE_RES = 512;
const IMAGE_RES_STR = `${IMAGE_RES}/${IMAGE_RES}`;

function AppItem({ app }: { app: App }) {
	const [imageError, setImageError] = useState(false);
	const [iconError, setIconError] = useState(false);
	const titleId = cleanHex(BigInt(app.id));
	const playerRangeStart = use$(view$.playerRangeStart);
	const playerRangeEnd = use$(view$.playerRangeEnd);
	const selectedGenres = use$(view$.selectedGenres);
	const { data: gameInfo } = useGameInfo(app.name);

	// Add this effect to handle genre population
	useEffect(() => {
		if (gameInfo?.genres) {
			const currentGenres = view$.genreList.get();
			const newGenres = gameInfo.genres.filter(genre => !currentGenres.includes(genre));
			if (newGenres.length > 0) {
				view$.genreList.set([...currentGenres, ...newGenres]);
			}
		}
	}, [gameInfo]);

	const playerCount = extractPlayerCount(gameInfo ?? null);
	const numericPlayerCount = parseInt(playerCount) || 1;

	// Hide games that don't match the selected player count range
	const hiddenByPlayers = numericPlayerCount < PLAYER_COUNT_MAP[playerRangeStart].count || numericPlayerCount > PLAYER_COUNT_MAP[playerRangeEnd].count;

	// Hide games that don't match any of the selected genres
	// If no genres are selected, show all games
	const hiddenByGenres = selectedGenres.length > 0 && (!gameInfo?.genres || !gameInfo.genres.some(genre => selectedGenres.includes(genre)));

	// Combine both filters
	const hidden = hiddenByPlayers || hiddenByGenres;

	return (
		<Box
			display={hidden ? 'none' : 'block'}
			key={app.id}
			className="flex cursor-pointer flex-col items-center"
			onClick={() => view$.selectedApp.set(app)}
		>
			<div className="relative flex aspect-square w-full items-center justify-center rounded-lg border border-nintendo-border bg-nintendo-bg">
				{!imageError && (
					<img
						src={iconError ? `https://tinfoil.media/ti/${titleId}/${IMAGE_RES_STR}` : `/icon/${app.id}`}
						alt={app.name}
						loading="lazy"
						className="size-full rounded-md object-cover"
						onError={() => {
							if (iconError) {
								setImageError(true);
							} else {
								setIconError(true);
							}
						}}
					/>
				)}
				<div className="absolute bottom-1 right-1 flex size-[16px] items-center justify-center rounded-full border-solid border-black bg-white opacity-80">
					<p className="text-[10px] font-bold text-black">{playerCount}</p>
				</div>
			</div>
			<Space h={4} />
			<p className="w-full truncate text-left text-xs font-medium">{app.name}</p>
		</Box>
	);
}

export default Apps;
