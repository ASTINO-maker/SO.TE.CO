import { DocumentsPageClient } from "../../../components/documents/documents-page-client";

interface DocumentsPageProps {
  searchParams?: Promise<{
    action?: string;
    filter?: string;
    id?: string;
  }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = (await searchParams) ?? {};
  return <DocumentsPageClient action={params.action} filter={params.filter} documentId={params.id} />;
}
