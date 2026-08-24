type PdfDocument = import('jspdf').jsPDF;

export const creatorCredit = 'Sistema creado y diseñado por Raul Cote';

export const addPdfFooters = (doc: PdfDocument) => {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 227, 234);
    doc.line(14, height - 12, width - 14, height - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 112, 126);
    doc.text(creatorCredit, 14, height - 7);
    doc.text(`Página ${page} de ${pages}`, width - 14, height - 7, { align: 'right' });
  }
};
