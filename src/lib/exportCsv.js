// Exporta movimientos a un CSV que Excel abre bien (con BOM y separador según idioma).

export function exportCsv({ transactions, goals, t, lang, memberName, year }) {
  const rows = transactions
    .filter((tx) => year == null || tx.year === year)
    .sort((a, b) => a.date.localeCompare(b.date));
  const sep = lang === 'en' ? ',' : ';';
  const num = (n) => (lang === 'en' ? n.toFixed(2) : n.toFixed(2).replace('.', ','));
  const esc = (v) => {
    const s = String(v ?? '');
    return /["\n\r;,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const catLabel = (tx) => {
    if (tx.type === 'saving') return goals.find((g) => g.id === tx.category)?.name || '';
    return t(`cat.${tx.category}`);
  };
  const header = ['csv.date', 'csv.type', 'csv.category', 'csv.concept', 'csv.amount', 'csv.frequency', 'csv.created_by', 'csv.notes'].map(t);
  const lines = [header.map(esc).join(sep)];
  for (const tx of rows) {
    lines.push([
      tx.date, t(`type.${tx.type}`), catLabel(tx), tx.concept, num(tx.amount),
      t(`freq.${tx.frequency || 'one-off'}`), memberName(tx.createdBy), tx.notes || '',
    ].map(esc).join(sep));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finanzas-casa-${year ?? 'todo'}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return rows.length;
}
