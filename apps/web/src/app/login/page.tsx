import { LoginPageClient } from "../../components/auth/login-page-client";

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  return <LoginPageClient nextHref={params.next ?? "/dashboard"} />;
}
