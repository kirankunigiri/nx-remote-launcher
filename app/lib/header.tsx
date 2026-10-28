import { use$ } from '@legendapp/state/react';
import { ActionIcon, TextInput } from '@mantine/core';
import { useState } from 'react';
import { LuSearch } from 'react-icons/lu';

import { view$ } from '~/lib/apps/apps';
import ConnectorControl from '~/lib/connector/connector-control';

function Header() {
	const [showSearch, setShowSearch] = useState(false);
	const search = use$(view$.search);

	return (
		<>
			<div className="fixed inset-x-0 top-0 z-50 flex h-[36px] w-full items-center justify-between border-b border-b-[#e5e5e5] bg-[rgba(250,250,250,0.85)] p-3 backdrop-blur-3xl dark:border-b-[#494949] dark:bg-[rgba(26,26,26,0.85)]">
				<p className="text-[13px] font-bold">NX Remote Launcher</p>

				<div className="flex items-center gap-2">
					<ConnectorControl />
					<div className={`overflow-hidden transition-all duration-200 ${showSearch ? 'w-[200px]' : 'w-8'}`}>
						{showSearch
							? (
								<TextInput
									classNames={{ input: 'border-none bg-transparent' }}
									leftSection={<LuSearch size={14} />}
									className="w-[200px]"
									size="xs"
									placeholder="Search"
									value={search}
									onChange={e => view$.search.set(e.target.value)}
									onBlur={() => {
										if (!search) {
											setShowSearch(false);
										}
									}}
									autoFocus
								/>
							)
							: (
								<ActionIcon
									color="gray"
									variant="subtle"
									onClick={() => setShowSearch(true)}
									size="sm"
								>
									<LuSearch size={16} />
								</ActionIcon>
							)}
					</div>
				</div>
			</div>
		</>
	);
}

export default Header;
