import { redirect } from 'next/navigation';
import { BottomNav } from '@/components/ui/bottom-nav';
import { SideNav } from '@/components/ui/side-nav';
import { createClient } from '@/lib/supabase/server';

/** Every screen in this group needs a signed-in user (second check behind the proxy). */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect('/login');

  // The Record tab goes to the open session, or starts a new one (DEC-044).
  const { data: open } = await supabase
    .from('sessions')
    .select('id, start_at')
    .is('end_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const recordHref = open
    ? `/sessions/${open.id}/${open.start_at ? 'record' : 'before'}`
    : '/sessions/new';

  return (
    <>
      <SideNav recordHref={recordHref} />
      <div className="flex flex-1 flex-col lg:pl-56">{children}</div>
      <BottomNav recordHref={recordHref} />
    </>
  );
}
