import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to /login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) => {
    const form = new FormData();
    form.append("username", username);
    form.append("password", password);
    return api.post<{ access_token: string; token_type: string }>("/auth/token", form);
  },
  me: () => api.get<User>("/auth/me"),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get<User[]>("/users"),
  create: (data: UserCreate) => api.post<User>("/users", data),
  update: (id: number, data: Partial<UserCreate>) => api.patch<User>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// ── Organization ──────────────────────────────────────────────────────────────
export const sitesApi = {
  list: () => api.get<Site[]>("/sites"),
  create: (data: Omit<Site, "id">) => api.post<Site>("/sites", data),
  update: (id: number, data: Partial<Site>) => api.patch<Site>(`/sites/${id}`, data),
  delete: (id: number) => api.delete(`/sites/${id}`),
};

export const areasApi = {
  list: (siteId?: number) => api.get<Area[]>("/areas", { params: { site_id: siteId } }),
  create: (data: Omit<Area, "id">) => api.post<Area>("/areas", data),
  update: (id: number, data: Partial<Area>) => api.patch<Area>(`/areas/${id}`, data),
  delete: (id: number) => api.delete(`/areas/${id}`),
};

export const linesApi = {
  list: (areaId?: number) => api.get<Line[]>("/lines", { params: { area_id: areaId } }),
  create: (data: Omit<Line, "id">) => api.post<Line>("/lines", data),
  update: (id: number, data: Partial<Line>) => api.patch<Line>(`/lines/${id}`, data),
  delete: (id: number) => api.delete(`/lines/${id}`),
};

export const machinesApi = {
  list: (lineId?: number) => api.get<Machine[]>("/machines", { params: { line_id: lineId } }),
  get: (id: number) => api.get<Machine>(`/machines/${id}`),
  create: (data: Omit<Machine, "id">) => api.post<Machine>("/machines", data),
  update: (id: number, data: Partial<Machine>) => api.patch<Machine>(`/machines/${id}`, data),
  delete: (id: number) => api.delete(`/machines/${id}`),
};

// ── Shifts ────────────────────────────────────────────────────────────────────
export const shiftSchedulesApi = {
  list: () => api.get<ShiftSchedule[]>("/shift-schedules"),
  create: (data: Omit<ShiftSchedule, "id">) => api.post<ShiftSchedule>("/shift-schedules", data),
  update: (id: number, data: Partial<ShiftSchedule>) => api.patch<ShiftSchedule>(`/shift-schedules/${id}`, data),
  delete: (id: number) => api.delete(`/shift-schedules/${id}`),
};

export const shiftInstancesApi = {
  list: (machineId?: number) =>
    api.get<ShiftInstance[]>("/shift-instances", { params: { machine_id: machineId } }),
  create: (data: Omit<ShiftInstance, "id" | "created_at">) => api.post<ShiftInstance>("/shift-instances", data),
  update: (id: number, data: Partial<ShiftInstance>) => api.patch<ShiftInstance>(`/shift-instances/${id}`, data),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list: () => api.get<Product[]>("/products"),
  create: (data: Omit<Product, "id">) => api.post<Product>("/products", data),
  update: (id: number, data: Partial<Product>) => api.patch<Product>(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
};

// ── Downtime ──────────────────────────────────────────────────────────────────
export const downtimeCategoriesApi = {
  list: () => api.get<DowntimeCategory[]>("/downtime-categories"),
  create: (data: Omit<DowntimeCategory, "id">) => api.post<DowntimeCategory>("/downtime-categories", data),
  update: (id: number, data: Partial<DowntimeCategory>) =>
    api.patch<DowntimeCategory>(`/downtime-categories/${id}`, data),
  delete: (id: number) => api.delete(`/downtime-categories/${id}`),
};

export const downtimeSecondaryCategoriesApi = {
  list: (primaryCategoryId?: number) =>
    api.get<DowntimeSecondaryCategory[]>("/downtime-secondary-categories", {
      params: { primary_category_id: primaryCategoryId },
    }),
  create: (data: Omit<DowntimeSecondaryCategory, "id">) =>
    api.post<DowntimeSecondaryCategory>("/downtime-secondary-categories", data),
  update: (id: number, data: Partial<DowntimeSecondaryCategory>) =>
    api.patch<DowntimeSecondaryCategory>(`/downtime-secondary-categories/${id}`, data),
  delete: (id: number) => api.delete(`/downtime-secondary-categories/${id}`),
};

export const downtimeCodesApi = {
  list: (secondaryCategoryId?: number) =>
    api.get<DowntimeCode[]>("/downtime-codes", { params: { secondary_category_id: secondaryCategoryId } }),
  create: (data: Omit<DowntimeCode, "id">) => api.post<DowntimeCode>("/downtime-codes", data),
  update: (id: number, data: Partial<DowntimeCode>) => api.patch<DowntimeCode>(`/downtime-codes/${id}`, data),
  delete: (id: number) => api.delete(`/downtime-codes/${id}`),
};

export const downtimeTagConfigsApi = {
  list: (machineId?: number) =>
    api.get<DowntimeTagConfig[]>("/downtime-tag-configs", { params: { machine_id: machineId } }),
  create: (data: Omit<DowntimeTagConfig, "id">) => api.post<DowntimeTagConfig>("/downtime-tag-configs", data),
  update: (id: number, data: Partial<DowntimeTagConfig>) =>
    api.patch<DowntimeTagConfig>(`/downtime-tag-configs/${id}`, data),
  delete: (id: number) => api.delete(`/downtime-tag-configs/${id}`),
};

export const downtimeEventsApi = {
  list: (params?: { machine_id?: number; shift_instance_id?: number; from_time?: string; to_time?: string }) =>
    api.get<DowntimeEvent[]>("/downtime-events", { params }),
  create: (data: DowntimeEventCreate) => api.post<DowntimeEvent>("/downtime-events", data),
  update: (id: number, data: Partial<DowntimeEvent>) => api.patch<DowntimeEvent>(`/downtime-events/${id}`, data),
  split: (id: number, split_time: string) =>
    api.post<DowntimeEvent>(`/downtime-events/${id}/split`, { split_time }),
};

// ── OEE Config ────────────────────────────────────────────────────────────────
export const oeeTargetsApi = {
  list: () => api.get<OEETarget[]>("/oee-targets"),
  create: (data: Omit<OEETarget, "id">) => api.post<OEETarget>("/oee-targets", data),
  update: (id: number, data: Partial<OEETarget>) => api.patch<OEETarget>(`/oee-targets/${id}`, data),
  delete: (id: number) => api.delete(`/oee-targets/${id}`),
};

export const availabilityConfigsApi = {
  list: (machineId?: number) =>
    api.get<AvailabilityConfig[]>("/availability-configs", { params: { machine_id: machineId } }),
  create: (data: Omit<AvailabilityConfig, "id">) => api.post<AvailabilityConfig>("/availability-configs", data),
  update: (id: number, data: Partial<AvailabilityConfig>) =>
    api.patch<AvailabilityConfig>(`/availability-configs/${id}`, data),
  delete: (id: number) => api.delete(`/availability-configs/${id}`),
};

export const performanceConfigsApi = {
  list: (machineId?: number) =>
    api.get<PerformanceConfig[]>("/performance-configs", { params: { machine_id: machineId } }),
  create: (data: Omit<PerformanceConfig, "id">) => api.post<PerformanceConfig>("/performance-configs", data),
  update: (id: number, data: Partial<PerformanceConfig>) =>
    api.patch<PerformanceConfig>(`/performance-configs/${id}`, data),
  delete: (id: number) => api.delete(`/performance-configs/${id}`),
};

export const qualityConfigsApi = {
  list: (machineId?: number) =>
    api.get<QualityConfig[]>("/quality-configs", { params: { machine_id: machineId } }),
  create: (data: Omit<QualityConfig, "id">) => api.post<QualityConfig>("/quality-configs", data),
  update: (id: number, data: Partial<QualityConfig>) =>
    api.patch<QualityConfig>(`/quality-configs/${id}`, data),
  delete: (id: number) => api.delete(`/quality-configs/${id}`),
};

export const rejectEventsApi = {
  list: (params?: { machine_id?: number; shift_instance_id?: number }) =>
    api.get<RejectEvent[]>("/reject-events", { params }),
  create: (data: RejectEventCreate) => api.post<RejectEvent>("/reject-events", data),
};

// ── OEE Metrics ───────────────────────────────────────────────────────────────
export const oeeMetricsApi = {
  oee: (params?: OEEQueryParams) => api.get<OEEMetric[]>("/oee-metrics/oee", { params }),
  availability: (params?: OEEQueryParams) => api.get<OEEMetric[]>("/oee-metrics/availability", { params }),
  performance: (params?: OEEQueryParams) => api.get<OEEMetric[]>("/oee-metrics/performance", { params }),
  quality: (params?: OEEQueryParams) => api.get<OEEMetric[]>("/oee-metrics/quality", { params }),
  current: (machineId: string) => api.get<OEEMetric>(`/oee-metrics/current/${machineId}`),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  line_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role: string;
  line_id?: number | null;
}

export interface Site { id: number; name: string; description?: string; timezone: string; }
export interface Area { id: number; site_id: number; name: string; description?: string; }
export interface Line { id: number; area_id: number; name: string; description?: string; }
export interface Machine { id: number; line_id: number; name: string; description?: string; opcua_node_id?: string; }

export interface ShiftSchedule {
  id: number; site_id: number; name: string;
  start_time: string; end_time: string;
  days_of_week: number[]; is_active: boolean;
}
export interface ShiftInstance {
  id: number; schedule_id: number; machine_id: number;
  actual_start: string; actual_end?: string;
  operator_id?: number; is_confirmed: boolean; created_at: string;
}

export interface Product { id: number; name: string; sku: string; description?: string; }

export interface DowntimeCategory {
  id: number; name: string; description?: string; counts_against_availability: boolean;
}
export interface DowntimeSecondaryCategory {
  id: number; primary_category_id: number; name: string; description?: string;
}
export interface DowntimeCode {
  id: number; secondary_category_id: number; name: string; description?: string;
}
export interface DowntimeTagConfig {
  id: number; machine_id: number; measurement_name: string; tag_field: string;
  tag_type: "digital" | "analog"; digital_downtime_value?: string;
  analog_operator?: string; analog_threshold?: number;
  downtime_category_id?: number; description?: string; is_enabled: boolean;
}
export interface DowntimeEvent {
  id: number; machine_id: number; shift_instance_id?: number;
  start_time: string; end_time?: string; reason_code_id?: number;
  comments?: string; operator_id?: number; created_at: string;
  source_tag_config_id?: number; parent_event_id?: number; is_split: boolean;
}
export interface DowntimeEventCreate {
  machine_id: number; shift_instance_id?: number;
  start_time: string; end_time?: string;
  reason_code_id?: number; comments?: string;
}

export interface OEETarget {
  id: number; machine_id?: number; line_id?: number;
  availability_target: number; performance_target: number;
  quality_target: number; oee_target: number;
}
export interface AvailabilityConfig {
  id: number; machine_id: number; state_tag?: string;
  running_value?: string; stopped_value?: string; faulted_value?: string;
  idle_value?: string; changeover_value?: string; planned_downtime_value?: string;
  excluded_category_ids: number[]; planned_production_time_seconds?: number;
}
export interface PerformanceConfig {
  id: number; machine_id: number; product_id?: number;
  ideal_cycle_time_seconds: number; rated_speed?: number;
  cycle_count_tag?: string; minor_stoppage_threshold_seconds: number;
}
export interface QualityConfig {
  id: number; machine_id: number; product_id?: number;
  good_parts_tag?: string; reject_parts_tag?: string;
  manual_reject_entry: boolean; cost_per_unit?: number; quality_target: number;
}
export interface RejectEvent {
  id: number; machine_id: number; shift_instance_id?: number;
  timestamp: string; reject_count: number; reason_code_id?: number;
  operator_id?: number; is_manual: boolean; comments?: string; created_at: string;
}
export interface RejectEventCreate {
  machine_id: number; shift_instance_id?: number;
  timestamp: string; reject_count: number;
  reason_code_id?: number; is_manual?: boolean; comments?: string;
}

export interface OEEMetric {
  time?: string; machine_id?: string; shift_id?: string;
  availability?: number; performance?: number; quality?: number; oee?: number;
  planned_time_seconds?: number; actual_run_time_seconds?: number;
  total_parts?: number; good_parts?: number; reject_parts?: number;
  value?: number;
}
export interface OEEQueryParams {
  machine_id?: string; from_time?: string; to_time?: string; limit?: number;
}
