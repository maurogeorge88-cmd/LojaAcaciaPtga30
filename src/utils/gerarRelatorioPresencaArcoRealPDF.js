import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Relatório geral de presença do Arco Real — mesma estrutura visual do
// relatório da Loja (gerarRelatorioPresencaPDF.js), mas sem coluna de grau
// (Arco Real tem grau único) e sem quadros de cruzamento por grau. Membros
// "licenciado" contam normalmente na presença/ausência (mesma regra atual
// da Loja: licença não exclui elegibilidade, só recebe marcação
// informativa "Lic." e rótulo abaixo do nome).
export const gerarRelatorioPresencaArcoRealPDF = (sessoes, membros, grade, anoSelecionado, mesSelecionado, dadosLoja) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const formatarData = (data) => {
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatarNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ').filter(p => p.length > 0);
    if (partes.length <= 2) return nomeCompleto;
    const preposicoes = ['de', 'da', 'do', 'das', 'dos'];
    if (preposicoes.includes(partes[1].toLowerCase())) {
      return `${partes[0]} ${partes[partes.length - 1]}`;
    }
    return partes.slice(0, 2).join(' ');
  };

  // CABEÇALHO
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 30, 'F');

  const nomeLoja = dadosLoja?.nome_loja || 'A∴R∴L∴S∴ Acácia de Paranatinga';
  const numeroLoja = dadosLoja?.numero_loja || '30';
  const grandeLoja = dadosLoja?.grande_loja || 'Grande Oriente do Brasil';
  const cidadeLoja = dadosLoja?.cidade || 'Paranatinga';
  const estadoLoja = dadosLoja?.estado || 'MT';

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`${nomeLoja} nº ${numeroLoja}`, pageWidth / 2, 10, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${grandeLoja} - ${cidadeLoja}/${estadoLoja}`, pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GRADE DE PRESENÇA — ARCO REAL', pageWidth / 2, 24, { align: 'center' });

  // Período
  doc.setFontSize(10);
  doc.setTextColor(100);
  const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  let periodo;
  if (mesSelecionado === 0) {
    periodo = `Ano ${anoSelecionado}`;
  } else if (mesSelecionado === -1) {
    periodo = `1º Semestre/${anoSelecionado}`;
  } else if (mesSelecionado === -2) {
    periodo = `2º Semestre/${anoSelecionado}`;
  } else {
    periodo = `${meses[mesSelecionado]}/${anoSelecionado}`;
  }
  doc.text(`Período: ${periodo}`, 10, 36);

  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  doc.text(`Gerado em: ${dataGeracao}`, pageWidth - 10, 36, { align: 'right' });

  // PREPARAR DADOS DA TABELA
  const headers = [{ title: 'Membro', dataKey: 'nome' }];
  sessoes.forEach((sessao, index) => {
    headers.push({ title: formatarData(sessao.data_sessao), dataKey: `sessao_${index}` });
  });
  headers.push({ title: 'Total', dataKey: 'total' });
  headers.push({ title: '%', dataKey: 'percentual' });

  const rowMembroIds = [];
  const taxasIndividuais = [];

  const rows = membros.map(membro => {
    const licenciado = membro.situacao?.toLowerCase() === 'licenciado';
    const row = {
      nome: licenciado
        ? (formatarNome(membro.nome) + String.fromCharCode(10) + 'Licença')
        : formatarNome(membro.nome)
    };

    let presencas = 0;
    let sessoesElegiveis = 0;

    sessoes.forEach((sessao, index) => {
      const reg = grade[membro.id]?.[sessao.id];
      sessoesElegiveis++;

      if (reg?.presente) {
        presencas++;
        row[`sessao_${index}`] = 'P';
      } else if (reg?.justificativa) {
        row[`sessao_${index}`] = 'J';
      } else {
        row[`sessao_${index}`] = 'F';
      }
    });

    rowMembroIds.push(membro.id);
    row.total = `${presencas}/${sessoesElegiveis}`;
    row.percentual = sessoesElegiveis > 0 ? `${Math.round((presencas / sessoesElegiveis) * 100)}%` : '0%';

    if (sessoesElegiveis > 0) {
      taxasIndividuais.push(Math.round((presencas / sessoesElegiveis) * 100));
    }

    return row;
  });

  const totalRow = { nome: 'TOTAL DE PRESENÇAS' };
  sessoes.forEach((sessao, index) => {
    const totalPresencas = rows.filter(r => r[`sessao_${index}`] === 'P').length;
    totalRow[`sessao_${index}`] = totalPresencas.toString();
  });
  totalRow.total = '';
  totalRow.percentual = '';
  rows.push(totalRow);

  doc.autoTable({
    startY: 42,
    head: [headers.map(h => h.title)],
    body: rows.map(row => headers.map(h => row[h.dataKey])),
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      overflow: 'linebreak',
      halign: 'center',
      valign: 'middle',
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 34 }
    },
    bodyStyles: { minCellHeight: 5 },
    didParseCell: function(data) {
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [230, 230, 230];
      }
      if (data.column.index === 0 && data.section === 'body' && data.row.index < rows.length - 1) {
        const raw = String(data.cell.raw || '');
        if (raw.includes('Licen')) {
          data.cell.styles.textColor = [10, 36, 99];
        }
      }
      if (data.column.index >= headers.length - 2) {
        data.cell.styles.fillColor = [220, 240, 255];
        data.cell.styles.fontStyle = 'bold';
        if (data.section === 'head') {
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fillColor = [180, 215, 255];
        }
      }
      if (data.cell.raw === 'P') {
        data.cell.styles.textColor = [0, 150, 0];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.cell.raw === 'F') {
        data.cell.styles.textColor = [200, 0, 0];
      }
      if (data.cell.raw === 'J') {
        data.cell.styles.textColor = [200, 100, 0];
      }
    },
    didDrawCell: function(data) {
      if (data.section !== 'body') return;
      const rowIdx = data.row.index;
      if (rowIdx >= rowMembroIds.length) return;
      const membroId = rowMembroIds[rowIdx];
      const membro = membros.find(m => m.id === membroId);
      if (!membro || membro.situacao?.toLowerCase() !== 'licenciado') return;

      const sessaoIdx = data.column.index - 1; // offset: col 0 = nome
      if (sessaoIdx < 0 || sessaoIdx >= sessoes.length) return;

      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 36, 99);
      const x = data.cell.x + 0.8;
      const y = data.cell.y + data.cell.height - 1.2;
      doc.text('Lic.', x, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0);
    },
    didDrawPage: function() {
      const pageCount = doc.internal.getNumberOfPages();
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
      doc.setDrawColor(200);
      doc.line(10, pageHeight - 8, pageWidth - 10, pageHeight - 8);
    }
  });

  // Resumo geral
  let ySum = doc.lastAutoTable.finalY + 10;
  if (ySum > pageHeight - 30) { doc.addPage(); ySum = 18; }

  const totalSessoesGeral = sessoes.length;
  const pctPresGeral = taxasIndividuais.length > 0
    ? Math.round(taxasIndividuais.reduce((s, t) => s + t, 0) / taxasIndividuais.length)
    : 0;
  const pctAusGeral = taxasIndividuais.length > 0 ? 100 - pctPresGeral : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Situação Geral do Arco Real', pageWidth / 2, ySum, { align: 'center' });
  ySum += 6;

  doc.autoTable({
    startY: ySum,
    head: [['Qtd. Sessões', '% Presença Geral', '% Ausência Geral']],
    body: [[String(totalSessoesGeral), `${pctPresGeral}%`, `${pctAusGeral}%`]],
    theme: 'grid',
    styles: { fontSize: 10, halign: 'center', fontStyle: 'bold', cellPadding: 4 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
  });

  const totalPaginasFinal = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginasFinal; p++) {
    doc.setPage(p);
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth / 2 - 25, pageHeight - 9.5, 50, 6, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Página ${p} de ${totalPaginasFinal}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    doc.setDrawColor(200);
    doc.line(10, pageHeight - 8, pageWidth - 10, pageHeight - 8);
  }

  let nomeArquivo;
  if (mesSelecionado === 0) {
    nomeArquivo = `Grade_Presenca_ArcoReal_${anoSelecionado}.pdf`;
  } else if (mesSelecionado === -1) {
    nomeArquivo = `Grade_Presenca_ArcoReal_1Sem_${anoSelecionado}.pdf`;
  } else if (mesSelecionado === -2) {
    nomeArquivo = `Grade_Presenca_ArcoReal_2Sem_${anoSelecionado}.pdf`;
  } else {
    nomeArquivo = `Grade_Presenca_ArcoReal_${meses[mesSelecionado]}_${anoSelecionado}.pdf`;
  }

  doc.save(nomeArquivo);
};
