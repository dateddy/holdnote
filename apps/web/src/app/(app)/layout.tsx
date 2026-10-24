import { redirect } from 'next/navigation';
import { HistoryNav } from '@/components/nav/history-nav';
import { AppShell } from '@/components/ui/app-shell';
import { BottomNav } from '@/components/ui/bottom-nav';
import { createClient } from '@/lib/supabase/server';

/** Every screen in this group needs a signed-in user (second check behind the proxy). */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login');

  return (
    <>
      <HistoryNav />
      <AppShell>{children}</AppShell>
      <BottomNav />
    </>
  );
}
