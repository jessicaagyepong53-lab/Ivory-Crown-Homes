// Transform MongoDB documents → plain objects using frontend field names

function txDoc(d) {
  const obj = d.toObject ? d.toObject() : d;
  const { _id, __v, ...rest } = obj;
  return { did: _id.toString(), ...rest };
}

function txPayment(p) {
  const obj = p.toObject ? p.toObject() : p;
  const { _id, ...rest } = obj;
  return { pid: _id.toString(), ...rest };
}

function txTenant(t) {
  const obj = t.toObject ? t.toObject() : t;
  const { _id, __v, ...rest } = obj;
  return {
    tid: _id.toString(),
    ...rest,
    payments:     (rest.payments     || []).map(txPayment),
    documents:    (rest.documents    || []).map(txDoc),
    leaseHistory: (rest.leaseHistory || []).map((h) => ({
      ...h,
      documents: (h.documents || []).map(txDoc),
    })),
  };
}

function txUnit(u) {
  const obj = u.toObject ? u.toObject() : u;
  const { _id, __v, ...rest } = obj;
  return {
    uid: _id.toString(),
    ...rest,
    tenants: (rest.tenants || []).map(txTenant),
  };
}

function txBlock(b) {
  const obj = b.toObject ? b.toObject() : b;
  const { _id, __v, createdAt, updatedAt, ...rest } = obj;
  return {
    bid: _id.toString(),
    ...rest,
    units: (rest.units || []).map(txUnit),
  };
}

function txMaint(m) {
  const obj = m.toObject ? m.toObject() : m;
  const { _id, __v, createdAt, updatedAt, ...rest } = obj;
  return {
    id: _id.toString(),
    ...rest,
    blockId: rest.blockId?.toString(),
    blockIds: (rest.blockIds || []).map((id) => id?.toString()),
    unitId:  rest.unitId?.toString(),
    attachments: (rest.attachments || []).map((a) => {
      const attachment = a.toObject ? a.toObject() : a;
      const { _id: aid, ...attachmentRest } = attachment;
      return {
        aid: aid?.toString(),
        ...attachmentRest,
      };
    }),
  };
}

export { txBlock, txUnit, txTenant, txDoc, txMaint };
