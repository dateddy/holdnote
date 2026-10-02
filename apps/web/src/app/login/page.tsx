import { safeNextPath } from '@/lib/auth/next-path';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  const authFailed = params.error === 'auth';

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-semibold">HoldNote</h1>
        <p className="text-sm opacity-70">Sổ Tay Hand — nhật ký học poker</p>
      </div>
      {authFailed && (
        <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-600">
          Đăng nhập không thành công hoặc link đã hết hạn. Thử lại.
        </p>
      )}
      <LoginForm next={next} />
    </main>
  );
}
