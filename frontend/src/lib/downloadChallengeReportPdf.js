import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function fmtPts(n) {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1).replace(/\.0$/, '');
}

const GOLD = [201, 176, 122];
const INK = [20, 18, 12];
const MUTED = [90, 88, 82];
const LINE = [220, 216, 208];
const PAPER = [252, 250, 246];
const CORAL = [180, 70, 90];
const TEAL = [40, 120, 110];

function pdfText(value) {
  return String(value ?? '')
    .replace(/[—–]/g, '-')
    .replace(/→/g, '->')
    .replace(/·/g, '|');
}

function slug(value) {
  return String(value || 'streakwars')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'streakwars';
}

function rankLabel(rank) {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function addFooter(doc, title) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(14, height - 12, width - 14, height - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`StreakWars  ·  ${title}`, 14, height - 7);
    doc.text(`${i} / ${pageCount}`, width - 14, height - 7, { align: 'right' });
  }
}

export function downloadChallengeReportPdf({
  title,
  duration,
  startDate,
  endDate,
  stakes,
  derived,
  rows,
  notables,
}) {
  const challengeTitle = title || 'StreakWars';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const leader = derived[0];
  const spoon = derived.length > 1 ? derived[derived.length - 1] : null;

  doc.setFillColor(...PAPER);
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('STREAKWARS FINAL REPORT', 14, 18);

  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(pdfText(challengeTitle), 14, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const meta = [
    `${duration || 30}-day circuit closed`,
    startDate && endDate ? `${startDate}  →  ${endDate}` : null,
    stakes || 'lowest score buys the party',
  ].filter(Boolean).join('   |   ');
  doc.text(pdfText(meta), 14, 35, { maxWidth: pageWidth - 28 });

  autoTable(doc, {
    startY: 42,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 3.5, textColor: INK },
    body: [[
      { content: pdfText(`Champion\n${(leader?.name || '-').toUpperCase()}\n${fmtPts(leader?.score_final)} pts`), styles: { fontStyle: 'bold' } },
      { content: pdfText(`Field\n${derived.length} drivers\nfinal standings`), styles: { fontStyle: 'bold' } },
      { content: pdfText(`Wooden spoon\n${(spoon?.name || '-').toUpperCase()}\n${spoon ? `${fmtPts(spoon.score_final)} pts` : '-'}`), styles: { fontStyle: 'bold', textColor: spoon ? CORAL : INK } },
    ]],
    didParseCell: (data) => {
      data.cell.styles.lineWidth = 0.2;
      data.cell.styles.lineColor = LINE;
    },
  });

  let y = (doc.lastAutoTable?.finalY || 60) + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text('Rank recap', 14, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [['Rank', 'Driver', 'Score', 'E / M / H', 'Fresh', 'Resub', 'Streak pts', 'Longest', 'Active days']],
    body: derived.map((u) => [
      rankLabel(u.rank),
      u.name,
      fmtPts(u.score_final),
      `${u.easy_solved} / ${u.medium_solved} / ${u.hard_solved}`,
      fmtPts(u.parts.fresh),
      fmtPts(u.parts.resub),
      fmtPts(u.parts.streak),
      `${u.longest_streak || 0}d`,
      String(u.active_days),
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: INK, overflow: 'linebreak' },
    headStyles: { fillColor: INK, textColor: GOLD, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [246, 243, 237] },
    columnStyles: {
      0: { cellWidth: 12 },
      2: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  if (notables.length) {
    y = (doc.lastAutoTable?.finalY || y) + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text('Category leaders', 14, y);

    autoTable(doc, {
      startY: y + 2,
      head: [['Category', 'Driver', 'Value']],
      body: notables.map((n) => [n.label, n.name, String(n.value)]),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4, textColor: INK },
      headStyles: { fillColor: INK, textColor: GOLD, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 243, 237] },
      margin: { left: 14, right: 14 },
    });
  }

  y = (doc.lastAutoTable?.finalY || y) + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text('Comparison matrix', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Best value in each row is marked *', 14, y + 5);

  autoTable(doc, {
    startY: y + 7,
    head: [['Stat', ...derived.map((u) => `${u.name} (P${u.rank})`)]],
    body: rows.map((row) => [
      row.label,
      ...derived.map((u) => {
        const raw = row.get(u);
        const shown = pdfText(row.format ? row.format(raw) : raw);
        return row.winners.has(u.user_id) ? `${shown} *` : shown;
      }),
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.1, textColor: INK, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 } },
    headStyles: { fillColor: INK, textColor: GOLD, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    alternateRowStyles: { fillColor: [246, 243, 237] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0 && String(data.cell.raw).includes(' *')) {
        data.cell.styles.textColor = TEAL;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc.lastAutoTable?.finalY || y) + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text('Head-to-head', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Row score minus column score. Positive means the row driver is ahead.', 14, y + 5);

  autoTable(doc, {
    startY: y + 7,
    head: [['vs', ...derived.map((u) => u.name)]],
    body: derived.map((rowUser) => [
      rowUser.name,
      ...derived.map((colUser) => {
                if (rowUser.user_id === colUser.user_id) return '-';
        const diff = Math.round(((rowUser.score_final || 0) - (colUser.score_final || 0)) * 10) / 10;
        return `${diff > 0 ? '+' : ''}${fmtPts(diff)}`;
      }),
    ]),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.1, textColor: INK, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    headStyles: { fillColor: INK, textColor: GOLD, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    alternateRowStyles: { fillColor: [246, 243, 237] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index === 0) return;
      const raw = String(data.cell.raw || '');
      if (raw.startsWith('+')) data.cell.styles.textColor = TEAL;
      if (raw.startsWith('-')) data.cell.styles.textColor = CORAL;
    },
  });

  addFooter(doc, challengeTitle);
  doc.save(`${slug(challengeTitle)}-final-report.pdf`);
}
