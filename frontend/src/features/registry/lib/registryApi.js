import api from '@/lib/api';

export const structuresApi = {
  list: (params) => api.get('/api/structures', { params }),
  get: (id) => api.get(`/api/structures/${id}`),
  create: (data) => api.post('/api/structures', data),
  update: (id, data) => api.put(`/api/structures/${id}`, data),
  types: () => api.get('/api/structure-types'),
  licenses: (id) => api.get(`/api/structures/${id}/licenses`),
  createLicense: (id, data) => api.post(`/api/structures/${id}/licenses`, data),
  sanctions: (id) => api.get(`/api/structures/${id}/sanctions`),
  createSanction: (id, data) => api.post(`/api/structures/${id}/sanctions`, data),
  updateSanction: (id, data) => api.patch(`/api/sanctions/${id}`, data),
  advisorReports: (id) => api.get(`/api/structures/${id}/advisor-reports`),
  timeline: (id) => api.get(`/api/structures/${id}/timeline`),
};

export const inspectionsApi = {
  list: (params) => api.get('/api/inspections', { params }),
  get: (id) => api.get(`/api/inspections/${id}`),
  create: (data) => api.post('/api/inspections', data),
  update: (id, data) => api.patch(`/api/inspections/${id}`, data),
  submitReport: (id, formData) => api.post(`/api/inspections/${id}/report`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getReport: (id) => api.get(`/api/inspections/${id}/report`),
  updateReportStatus: (reportId, data) => api.patch(`/api/inspection-reports/${reportId}`, data),
};

export const committeesApi = {
  list: () => api.get('/api/committees'),
  get: (id) => api.get(`/api/committees/${id}`),
  create: (data) => api.post('/api/committees', data),
  update: (id, data) => api.put(`/api/committees/${id}`, data),
  addMember: (id, data) => api.post(`/api/committees/${id}/members`, data),
  removeMember: (id, userId) => api.delete(`/api/committees/${id}/members/${userId}`),
  assignStructure: (id, data) => api.post(`/api/committees/${id}/structures`, data),
};

export const sanctionsApi = {
  list: () => api.get('/api/sanctions'),
  rules: (structureTypeId) => api.get('/api/sanction-rules', {
    params: structureTypeId ? { structure_type_id: structureTypeId } : {},
  }),
  createRule: (data) => api.post('/api/sanction-rules', data),
  calculate: (data) => api.post('/api/sanctions/calculate', data),
};

export const decisionsApi = {
  list: (params) => api.get('/api/sanction-decisions', { params }),
  get: (id) => api.get(`/api/sanction-decisions/${id}`),
  create: (data) => api.post('/api/sanction-decisions', data),
  update: (id, data) => api.patch(`/api/sanction-decisions/${id}`, data),
  submit: (id) => api.post(`/api/sanction-decisions/${id}/submit`),
  approve: (id, data) => api.post(`/api/sanction-decisions/${id}/approve`, data),
  notify: (id, data) => api.post(`/api/sanction-decisions/${id}/notify`, data),
  payment: (id, data) => api.post(`/api/sanction-decisions/${id}/payment`, data),
  export: (id) => api.get(`/api/sanction-decisions/${id}/export`),
  pdf: (id) => api.get(`/api/sanction-decisions/${id}/pdf`, { responseType: 'blob' }),
};

export const interopApi = {
  aadeLookup: (afm) => api.post('/api/interop/aade/lookup', { afm }),
  log: () => api.get('/api/interop/log'),
};

export const checklistApi = {
  templates: () => api.get('/api/checklist-templates'),
  forType: (typeId) => api.get(`/api/checklist-templates/${typeId}`),
};

export const oversightApi = {
  dashboard: () => api.get('/api/oversight/dashboard'),
  alerts: () => api.get('/api/oversight/alerts'),
  dailyAgenda: () => api.get('/api/oversight/daily-agenda'),
  reports: (type, params) => api.get(`/api/oversight/reports/${type}`, { params, responseType: 'blob' }),
  userRoles: () => api.get('/api/user-roles'),
  assignRole: (data) => api.post('/api/user-roles', data),
  removeRole: (id) => api.delete(`/api/user-roles/${id}`),
  submitAdvisorReport: (structureId, formData) => api.post(
    `/api/structures/${structureId}/advisor-reports`, formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
  getAdvisorReport: (id) => api.get(`/api/advisor-reports/${id}`),
  updateAdvisorReport: (id, data) => api.patch(`/api/advisor-reports/${id}`, data),
  approveReport: (id, action) => api.patch(`/api/advisor-reports/${id}/approve`, { action }),
  iridaExport: (documentType, recordId) => api.get(
    `/api/irida-export/${documentType}/${recordId}`, { responseType: 'blob' }
  ),
};
