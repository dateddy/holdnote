import { POKER_CORE_VERSION } from 'poker-core';

// Placeholder until the real home screen (task 4.4). Confirms the workspace link to poker-core.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-3xl font-semibold">HoldNote</h1>
      <p className="text-sm opacity-70">Sổ Tay Hand · poker-core v{POKER_CORE_VERSION}</p>
    </main>
  );
}
