import API from './client.js';

export const fetchMaintenance  = ()          => API.get('/maintenance').then(r => r.data);
export const createMaintenance = (data)      => API.post('/maintenance', data).then(r => r.data);
export const updateMaintenance = (id, data)  => API.put(`/maintenance/${id}`, data).then(r => r.data);
