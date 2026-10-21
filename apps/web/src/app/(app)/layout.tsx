import { redirect } from 'next/navigation';
import { HistoryNav } from '@/components/nav/history-nav';
import { BottomNav } from '@/components/ui/bottom-nav';
import { SideNav } from '@/components/ui/side-nav';
import { createClient } from '@/lib/supabase/server';

/** Every screen in this group needs a signed-in user (second check behind the proxy). */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login');

  return (
    <>
      <HistoryNav />
      <SideNav />
      <div className="flex flex-1 flex-col lg:pl-56">{children}</div>
      <BottomNav />
    </>
  );
}
