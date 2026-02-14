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

export const oversightApi = {
  dashboard: () => api.get('/api/oversight/dashboard'),
  alerts: () => api.get('/api/oversight/alerts'),
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
};
