import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Relatório simples para envio a terceiros: relação de membros do Arco Real
// com nome, cargo e data de exaltação. Cabeçalho com os dados do próprio Capítulo (Guardiões
// da Aliança nº 04), não os da Loja.
export const gerarRelatorioMembrosArcoRealPDF = (membros, logoUrl) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const gerarConteudo = () => {
    // CABEÇALHO
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Logo (data URL base64) à esquerda — desenhada DEPOIS da faixa azul, senão fica coberta.
    if (logoUrl) {
      try { doc.addImage(logoUrl, 'PNG', 12, 4, 24, 24); } catch (e) { /* segue sem logo */ }
    }

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Arco Real — Guardiões da Aliança nº 04', pageWidth / 2, 12, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Paranatinga/MT', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(12.5);
    doc.setFont('helvetica', 'bold');
    doc.text('RELAÇÃO DE MEMBROS', pageWidth / 2, 26, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Emitido em: ${dataGeracao}`, pageWidth - 12, 40, { align: 'right' });
    doc.text(`${membros.length} membro(s)`, 12, 40);

    // TABELA
    const linhaSituacao = (m) => {
      const sit = (m.situacao || '').toLowerCase();
      if (sit === 'licenciado') return ' (Licenciado)';
      return '';
    };

    const fmtData = (d) => {
      if (!d) return '—';
      const [a, mes, dia] = String(d).substring(0, 10).split('-');
      return a && mes && dia ? `${dia}/${mes}/${a}` : '—';
    };

    doc.autoTable({
      startY: 44,
      head: [['Nome', 'Cargo', 'Data de exaltação']],
      body: membros.map(m => [
        `${m.nome}${linhaSituacao(m)}`,
        m.cargo && m.cargo.trim() ? m.cargo : '—',
        fmtData(m.data_exaltacao)
      ]),
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'middle',
        lineColor: [210, 210, 210],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [30, 58, 95],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 75 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 32, halign: 'center' }
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      margin: { left: 12, right: 12 },
      didDrawPage: function() {
        const pageCount = doc.internal.getNumberOfPages();
        const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      }
    });

    doc.save('Relacao_Membros_ArcoReal.pdf');
  };

  gerarConteudo();
};
