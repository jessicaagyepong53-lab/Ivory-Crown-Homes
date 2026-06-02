import API from './client.js';

export async function uploadDocument(tid, file, category, note) {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  form.append('note', note || '');
  const { data } = await API.post(`/tenants/${tid}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data; // returns the new document object { did, name, url, ... }
}

export async function deleteDocument(did) {
  const { data } = await API.delete(`/documents/${did}`);
  return data;
}
