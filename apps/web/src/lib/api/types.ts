export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
  path: string;
  method: string;
  timestamp: string;
  requestId?: string;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  [key: string]: string | number | boolean | undefined;
}

