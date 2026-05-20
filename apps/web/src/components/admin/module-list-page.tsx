import type { ReactNode } from "react";
import { FilterBar } from "./filter-bar";
import { DataTable, type DataTableColumn } from "./data-table";
import { PageHeader } from "./page-header";
import type { WorkspaceHeroMetric } from "./workspace-hero";

export function ModuleListPage<T>({
  eyebrow,
  title,
  description,
  actions,
  note,
  metrics,
  filters,
  tableTitle,
  columns,
  rows,
  emptyTitle,
  emptyDescription,
  emptyAction,
  secondary,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  note?: string;
  metrics?: WorkspaceHeroMetric[];
  filters: ReactNode;
  tableTitle: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} note={note} metrics={metrics} />
      <FilterBar>{filters}</FilterBar>
      <DataTable
        title={tableTitle}
        columns={columns}
        rows={rows}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
      />
      {secondary}
    </div>
  );
}
