import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const gerarRelatorioPresencaPDF = (sessoes, irmaos, grade, historicoSituacoes, anoSelecionado, mesSelecionado, dadosLoja) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Função auxiliar para formatar data
  const formatarData = (data) => {
    const d = new Date(data + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Função para formatar nome (2 nomes, mas se 2º for preposição, pega o último)
  const formatarNome = (nomeCompleto) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ').filter(p => p.length > 0);
    if (partes.length <= 2) return nomeCompleto;
    
    // Se o segundo nome for uma preposição, pega primeiro + último
    const preposicoes = ['de', 'da', 'do', 'das', 'dos'];
    if (preposicoes.includes(partes[1].toLowerCase())) {
      return `${partes[0]} ${partes[partes.length - 1]}`;
    }
    
    // Caso contrário, retorna os 2 primeiros
    return partes.slice(0, 2).join(' ');
  };

  // Função para obter grau do irmão
  const obterGrauIrmao = (irmao) => {
    if (irmao.mestre_instalado) return 'M.I';
    if (irmao.data_exaltacao) return 'M';
    if (irmao.data_elevacao) return 'C';
    return 'A';
  };

  // Função para verificar situação na data
  const verificarSituacaoNaData = (irmaoId, dataSessao) => {
    const situacao = historicoSituacoes?.find(sit => {
      if (sit.membro_id !== irmaoId) return false;
      
      const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
      const dataFim = sit.data_fim ? new Date(sit.data_fim + 'T00:00:00') : null;
      
      // Lista de situações que bloqueiam/afetam a presença
      const situacoesBloqueadoras = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio', 'licenca'];
      const ehBloqueadora = situacoesBloqueadoras.includes(tipoNormalizado) ||
        situacoesBloqueadoras.some(s => tipoNormalizado.includes(s));
      
      if (!ehBloqueadora) return false;
      
      // Verifica se a sessão está no período da situação
      if (dataSessao < dataInicio) return false;
      
      if (dataFim) {
        return dataSessao >= dataInicio && dataSessao <= dataFim;
      }
      
      return dataSessao >= dataInicio;
    });
    
    return situacao;
  };

  // CABEÇALHO
  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Nome da Loja
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
  doc.text('GRADE DE PRESENÇA', pageWidth / 2, 24, { align: 'center' });

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

  // Data de geração
  const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Gerado em: ${dataGeracao}`, pageWidth - 10, 36, { align: 'right' });

  // PREPARAR DADOS DA TABELA
  const headers = [
    { title: 'Irmão', dataKey: 'nome' },
    { title: 'Grau', dataKey: 'grau' }
  ];

  // Adicionar colunas de datas
  sessoes.forEach((sessao, index) => {
    const grauTexto = sessao.grau_sessao_id === 1 ? 'A' : 
                     sessao.grau_sessao_id === 2 ? 'C' : 
                     sessao.grau_sessao_id === 4 ? 'ADM' : 'M';
    headers.push({
      title: `${formatarData(sessao.data_sessao)}\n${grauTexto}`,
      dataKey: `sessao_${index}`
    });
  });

  headers.push({ title: 'Total', dataKey: 'total' });
  headers.push({ title: '%', dataKey: 'percentual' });

  // Função para verificar se irmão deve aparecer no relatório
  const deveAparecerNoRelatorio = (irmao) => {
    // Verifica se tem situação bloqueadora SEM data_fim (desligamento permanente)
    const temDesligamentoPermanente = historicoSituacoes?.some(sit => {
      if (sit.membro_id !== irmao.id) return false;
      
      const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const situacoesExclusivas = ['desligado', 'desligamento', 'excluido', 'ex-oficio'];
      const ehExclusiva = situacoesExclusivas.includes(tipoNormalizado) ||
        situacoesExclusivas.some(s => tipoNormalizado.includes(s));
      
      if (!ehExclusiva) return false;
      
      // Se tem data_fim no futuro ou passado, significa que pode voltar/voltou - DEVE aparecer
      if (sit.data_fim) return false;
      
      // Desligamento permanente (sem data_fim)
      const dataInicio = new Date(sit.data_inicio + 'T00:00:00');
      
      // Verifica se o desligamento aconteceu ANTES de todas as sessões do período
      const todasSessoesAposDesligamento = sessoes.every(s => {
        const dataSessao = new Date(s.data_sessao + 'T00:00:00');
        return dataSessao >= dataInicio;
      });
      
      // Se todas as sessões são após o desligamento, NÃO deve aparecer
      return todasSessoesAposDesligamento;
    });
    
    return !temDesligamentoPermanente;
  };

  // Preparar dados dos irmãos (filtrados)
  const rows = irmaos
    .filter(irmao => deveAparecerNoRelatorio(irmao))
    .map(irmao => {
    const row = {
      nome: formatarNome(irmao.nome),
      grau: obterGrauIrmao(irmao)
    };

    let presencas = 0;
    let sessoesElegiveis = 0;

    sessoes.forEach((sessao, index) => {
      const reg = grade[irmao.id]?.[sessao.id];
      const dataSessao = new Date(sessao.data_sessao + 'T00:00:00');
      
      // Verificar data de início (prioridade: data_ingresso_loja > data_inicio > data_iniciacao)
      const dataInicio = irmao.data_ingresso_loja
        ? new Date(irmao.data_ingresso_loja + 'T00:00:00')
        : irmao.data_inicio 
          ? new Date(irmao.data_inicio + 'T00:00:00')
          : irmao.data_iniciacao 
            ? new Date(irmao.data_iniciacao + 'T00:00:00')
            : null;
      
      if (dataInicio && dataSessao < dataInicio) {
        row[`sessao_${index}`] = '-';
        return;
      }

      // Verificar data de falecimento
      if (irmao.data_falecimento) {
        const dataFalecimento = new Date(irmao.data_falecimento + 'T00:00:00');
        if (dataSessao >= dataFalecimento) {
          row[`sessao_${index}`] = '-';
          return;
        }
      }

      // Verificar situação (irregular, suspenso, licença)
      const situacao = verificarSituacaoNaData(irmao.id, dataSessao);
      if (situacao) {
        row[`sessao_${index}`] = '-';
        return;
      }

      // Verificar grau
      const dataExaltacao = irmao.data_exaltacao ? new Date(irmao.data_exaltacao + 'T00:00:00') : null;
      const dataElevacao = irmao.data_elevacao ? new Date(irmao.data_elevacao + 'T00:00:00') : null;
      const dataInstalacao = irmao.data_instalacao ? new Date(irmao.data_instalacao + 'T00:00:00') : null;

      let grauNaSessao = 'A';
      if (irmao.mestre_instalado && (!dataInstalacao || dataSessao >= dataInstalacao)) {
        grauNaSessao = 'M.I';
      } else if (dataExaltacao && dataSessao >= dataExaltacao) {
        grauNaSessao = 'M';
      } else if (dataElevacao && dataSessao >= dataElevacao) {
        grauNaSessao = 'C';
      }

      // Verificar se pode participar baseado no grau da sessão
      let grauMinimoSessao = sessao.grau_sessao_id;
      
      // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
      if (grauMinimoSessao === 4) grauMinimoSessao = 1;
      
      const grauNumerico = grauNaSessao === 'A' ? 1 : grauNaSessao === 'C' ? 2 : 3;

      if (grauNumerico < grauMinimoSessao) {
        row[`sessao_${index}`] = '-';
        return;
      }

      // Contar como elegível
      sessoesElegiveis++;

      // Verificar presença
      if (reg?.presente) {
        presencas++;
        row[`sessao_${index}`] = 'P';
      } else if (reg?.justificativa) {
        row[`sessao_${index}`] = 'J';
      } else {
        row[`sessao_${index}`] = 'F';
      }
    });

    row.total = `${presencas}/${sessoesElegiveis}`;
    row.percentual = sessoesElegiveis > 0 
      ? `${Math.round((presencas / sessoesElegiveis) * 100)}%` 
      : '0%';

    return row;
  });

  // Calcular totalizadores por sessão
  const totalRow = {
    nome: 'TOTAL DE PRESENÇAS',
    grau: ''
  };

  sessoes.forEach((sessao, index) => {
    const totalPresencas = rows.filter(r => r[`sessao_${index}`] === 'P').length;
    totalRow[`sessao_${index}`] = totalPresencas.toString();
  });

  totalRow.total = '';
  totalRow.percentual = '';

  rows.push(totalRow);

  // GERAR TABELA
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
      fillColor: [41, 98, 255],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 6
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 30 },
      1: { halign: 'center', cellWidth: 12 }
    },
    bodyStyles: {
      minCellHeight: 5
    },
    didParseCell: function(data) {
      // Última linha (total) em negrito e fundo cinza
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [230, 230, 230];
      }
      
      // Colunas Total e %
      if (data.column.index >= headers.length - 2) {
        data.cell.styles.fillColor = [220, 240, 255];
        data.cell.styles.fontStyle = 'bold';
      }
      
      // Células com P em verde
      if (data.cell.raw === 'P') {
        data.cell.styles.textColor = [0, 150, 0];
        data.cell.styles.fontStyle = 'bold';
      }
      
      // Células com F em vermelho
      if (data.cell.raw === 'F') {
        data.cell.styles.textColor = [200, 0, 0];
      }
      
      // Células com J em laranja
      if (data.cell.raw === 'J') {
        data.cell.styles.textColor = [200, 100, 0];
      }
    },
    didDrawPage: function(data) {
      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Página ${currentPage} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
      
      // Linha de rodapé
      doc.setDrawColor(200);
      doc.line(10, pageHeight - 8, pageWidth - 10, pageHeight - 8);
    }
  });

  // Salvar PDF
  let nomeArquivo;
  if (mesSelecionado === 0) {
    nomeArquivo = `Grade_Presenca_${anoSelecionado}.pdf`;
  } else if (mesSelecionado === -1) {
    nomeArquivo = `Grade_Presenca_1Sem_${anoSelecionado}.pdf`;
  } else if (mesSelecionado === -2) {
    nomeArquivo = `Grade_Presenca_2Sem_${anoSelecionado}.pdf`;
  } else {
    nomeArquivo = `Grade_Presenca_${meses[mesSelecionado]}_${anoSelecionado}.pdf`;
  }
  
  doc.save(nomeArquivo);
};
