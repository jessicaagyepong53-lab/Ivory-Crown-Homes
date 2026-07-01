import API from './client.js';

export const fetchMaintenance  = ()          => API.get('/maintenance').then(r => r.data);
export const updateMaintenance = (id, data)  => API.put(`/maintenance/${id}`, data).then(r => r.data);
export const deleteMaintenanceAttachment = (id, attachmentId) =>
	API.delete(`/maintenance/${id}/attachments/${attachmentId}`).then((r) => r.data);
export const editMaintenance = (id, data) =>
	API.put(`/maintenance/${id}`, data).then((r) => r.data);
export const deleteMaintenance = (id) =>
	API.delete(`/maintenance/${id}`).then((r) => r.data);

export function parseMaintenanceReceiptUpload(file) {
	const formData = new FormData();
	formData.append('file', file);
	return API.post('/maintenance/parse-receipt', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	}).then((r) => r.data);
}

export function createMaintenance(data) {
	const hasFiles = Array.isArray(data.attachmentsFiles) && data.attachmentsFiles.length > 0;
	if (!hasFiles) {
		const { attachmentsFiles, ...plain } = data;
		return API.post('/maintenance', plain).then((r) => r.data);
	}

	const formData = new FormData();
	Object.entries(data).forEach(([key, value]) => {
		if (key === 'attachmentsFiles') return;
		if (value == null || value === '') return;
		formData.append(key, String(value));
	});
	data.attachmentsFiles.forEach((file) => formData.append('attachments', file));

	return API.post('/maintenance', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	}).then((r) => r.data);
}

export function maintenanceAttachmentUrl(entryId, attachmentId, download = false) {
	const token = localStorage.getItem('estatepro_token');
	const params = new URLSearchParams();
	if (token) params.set('token', token);
	if (download) params.set('dl', '1');
	return `/api/maintenance/${entryId}/attachments/${attachmentId}/file?${params.toString()}`;
}
