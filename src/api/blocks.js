import API from './client.js';

export const fetchBlocks   = ()          => API.get('/blocks').then(r => r.data);
export const createBlock   = (data)      => API.post('/blocks', data).then(r => r.data);
export const updateBlock   = (bid, data) => API.put(`/blocks/${bid}`, data).then(r => r.data);
export const deleteBlock   = (bid)       => API.delete(`/blocks/${bid}`).then(r => r.data);

export const addUnit       = (bid, data) => API.post(`/blocks/${bid}/units`, data).then(r => r.data);
export const updateUnit    = (uid, data) => API.put(`/units/${uid}`, data).then(r => r.data);
export const deleteUnit    = (uid)       => API.delete(`/units/${uid}`).then(r => r.data);

export const addTenant     = (uid, data) => API.post(`/units/${uid}/tenants`, data).then(r => r.data);
export const updateTenant  = (tid, data) => API.put(`/tenants/${tid}`, data).then(r => r.data);
export const deleteTenant  = (tid)       => API.delete(`/tenants/${tid}`).then(r => r.data);
