import { Suspense } from "react";
import { ProjectsPageClient } from "../../../../components/operations/projects-page-client";

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-[1.75rem] border border-black/6 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading projects...
        </div>
      }
    >
      <ProjectsPageClient />
    </Suspense>
  );
}
