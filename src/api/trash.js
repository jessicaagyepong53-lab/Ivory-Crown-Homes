import API from './client.js';

export const fetchTrash        = ()       => API.get('/trash').then(r => r.data);
export const restoreTrashItem  = (id)     => API.post(`/trash/${id}/restore`).then(r => r.data);
export const bulkRestoreTrash  = (ids)    => API.post('/trash/restore', { ids }).then(r => r.data);
export const deleteTrashItem   = (id)     => API.delete(`/trash/${id}`).then(r => r.data);
export const bulkDeleteTrash   = (ids)    => API.delete('/trash/bulk', { data: { ids } }).then(r => r.data);
