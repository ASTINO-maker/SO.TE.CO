import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { cn } from "../../lib/utils";
import type { ReactNode } from "react";
import { AdminEmptyState } from "./state-blocks";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  title,
  columns,
  rows,
  emptyTitle = "Aucune donnee disponible",
  emptyDescription = "Aucun element ne correspond aux filtres actuels. Ajustez vos criteres ou ajoutez un nouvel enregistrement.",
  emptyAction,
}: {
  title: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (!rows.length) {
    return (
      <Card className="border-[#ddd3c3] bg-[#fffdfa]">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminEmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-[#ddd3c3] bg-[#fffdfa]">
      <CardHeader className="border-b border-[#e7dece] bg-[#f8f2e8]">
        <CardTitle className="text-xl text-slate-900">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "border-b border-[#e7dece] px-4 py-3 font-medium uppercase tracking-[0.14em] text-slate-400",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="odd:bg-[#fffaf4] hover:bg-[#f6efe2]/70">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("border-b border-[#ece3d4] px-4 py-3 align-middle text-slate-700", column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
