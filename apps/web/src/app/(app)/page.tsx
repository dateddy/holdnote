import { createClient } from '@/lib/supabase/server';

// Temporary home until the real one (task 4.4).
export default async function Home() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('display_name').single();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">HoldNote</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline underline-offset-4">
            Đăng xuất
          </button>
        </form>
      </header>
      <p>Xin chào {profile?.display_name ?? ''}</p>
    </main>
  );
}
