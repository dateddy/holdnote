import { redirect } from 'next/navigation';

/** The hand list lives on the session page now (5.1d-2a); old links and bookmarks land there. */
export default async function HandListRedirect({ params }: PageProps<'/sessions/[id]/hands'>) {
  const { id } = await params;
  redirect(`/sessions/${id}`);
}
