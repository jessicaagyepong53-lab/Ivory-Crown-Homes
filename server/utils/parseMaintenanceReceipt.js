import * as pdfParseModule from 'pdf-parse/node';
import Tesseract from 'tesseract.js';

const pdfParse = pdfParseModule.default ?? pdfParseModule;

function parseMoney(value) {
  if (!value) return 0;
  const normalized = String(value).replace(/[^\d.]/g, '');
  return Number(normalized) || 0;
}

function normalizeDate(value) {
  if (!value) return '';
  const raw = value.trim();
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${month}-${day}`;
  }
  const asDate = new Date(raw);
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toISOString().slice(0, 10);
  }
  return '';
}

function parseLineItems(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)\s+(.+?)\s+(\d[\d,.]*)\s+(\d[\d,.]*)$/);
    if (!m) continue;
    const description = m[2].trim();
    if (/TOTAL|LABOUR|GRAND|ISSUE|PRICE/i.test(description)) continue;
    items.push({
      qty: Number(m[1]) || 0,
      description,
      unitPrice: parseMoney(m[3]),
      lineTotal: parseMoney(m[4]),
    });
  }
  return items;
}

function parseReceiptText(text) {
  const compact = text.replace(/[ \t]+/g, ' ');
  const issueDateMatch = compact.match(/date\s*of\s*issue\s*[:\-]?\s*([\w\-\/. ,]+)/i);
  const materialsMatch = compact.match(/total\s*of\s*materials\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
  const labourMatch = compact.match(/labou?r\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
  const grandTotalMatch = compact.match(/grand\s*total\s*[:=]?\s*([\d,]+(?:\.\d+)?)/i);
  const vendorLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => /ALUMINUM|FABRICATION|ENTERPRISE|COMPANY|LIMITED|WORKS/i.test(l)) || '';
  const contactMatch = compact.match(/(?:TEL|PHONE|CONTACT)\s*[:\-]?\s*([+\d][\d\s\-]{6,})/i);
  const locationMatch = compact.match(/LOCATION\s*[:\-]?\s*([^\n]+)/i);
  const items = parseLineItems(text);

  const materialsTotal = parseMoney(materialsMatch?.[1]);
  const labourTotal = parseMoney(labourMatch?.[1]);
  const grandTotal = parseMoney(grandTotalMatch?.[1]) || (materialsTotal + labourTotal);
  const issueDate = normalizeDate(issueDateMatch?.[1] || '');

  const itemSummary = items.slice(0, 5).map((i) => `${i.qty} x ${i.description}`).join(', ');
  const summaryDescription = itemSummary
    ? `Receipt items: ${itemSummary}${items.length > 5 ? ', ...' : ''}`
    : '';

  return {
    vendor: vendorLine,
    contractorContact: (contactMatch?.[1] || '').trim(),
    location: (locationMatch?.[1] || '').trim(),
    issueDate,
    materialsTotal,
    labourTotal,
    grandTotal,
    items,
    summaryDescription,
    rawText: text,
  };
}

export async function parseMaintenanceReceipt(fileBuffer, mimeType) {
  let text = '';

  if (mimeType === 'application/pdf') {
    const pdf = await pdfParse(fileBuffer);
    text = pdf.text || '';
  } else if (String(mimeType || '').startsWith('image/')) {
    const result = await Tesseract.recognize(fileBuffer, 'eng');
    text = result?.data?.text || '';
  } else {
    return {
      vendor: '',
      contractorContact: '',
      location: '',
      issueDate: '',
      materialsTotal: 0,
      labourTotal: 0,
      grandTotal: 0,
      items: [],
      summaryDescription: '',
      rawText: '',
    };
  }

  return parseReceiptText(text);
}
