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
      
      // Normalizar datas para comparação apenas de dia (sem hora)
      const dataInicioSit = new Date(sit.data_inicio + 'T00:00:00');
      dataInicioSit.setHours(0, 0, 0, 0);
      
      const dataFimSit = sit.data_fim ? new Date(sit.data_fim + 'T00:00:00') : null;
      if (dataFimSit) dataFimSit.setHours(0, 0, 0, 0);
      
      const dataSessaoNorm = new Date(dataSessao);
      dataSessaoNorm.setHours(0, 0, 0, 0);
      
      // Lista de situações que bloqueiam/afetam a presença
      const situacoesBloqueadoras = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio', 'licenca'];
      const ehBloqueadora = situacoesBloqueadoras.includes(tipoNormalizado) ||
        situacoesBloqueadoras.some(s => tipoNormalizado.includes(s));
      
      if (!ehBloqueadora) return false;
      
      // Verifica se a sessão está no período da situação
      if (dataSessaoNorm.getTime() < dataInicioSit.getTime()) return false;
      
      if (dataFimSit) {
        return dataSessaoNorm.getTime() >= dataInicioSit.getTime() && 
               dataSessaoNorm.getTime() <= dataFimSit.getTime();
      }
      
      return dataSessaoNorm.getTime() >= dataInicioSit.getTime();
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

  // Irmão sem NENHUMA responsabilidade/vínculo no período deste relatório —
  // some da listagem por completo (igual desligado/falecido). Isso acontece
  // quando ele tem uma situação bloqueadora (desligado, irregular, suspenso,
  // excluído, ex-ofício) SEM data_fim, e TODAS as sessões deste relatório
  // (seja do ano inteiro ou de um mês só) já são depois do início dela — ou
  // seja, não sobra nenhum dia "antes" pra mostrar. Se parte do período for
  // antes da situação, o irmão continua aparecendo normalmente (com os dados
  // reais até a data, e "-" dali em diante, tratado sessão a sessão mais abaixo).
  const naoTemMaisVinculoNoPeriodo = (irmao) => {
    return historicoSituacoes?.some(sit => {
      if (sit.membro_id !== irmao.id) return false;

      const tipoNormalizado = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const situacoesQueEncerram = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
      const ehEncerramento = situacoesQueEncerram.includes(tipoNormalizado) ||
        situacoesQueEncerram.some(s => tipoNormalizado.includes(s));

      if (!ehEncerramento) return false;
      if (sit.data_fim) return false; // tem data_fim = já foi regularizado, pode aparecer normalmente

      const dataInicio = new Date(sit.data_inicio + 'T00:00:00');

      // Todas as sessões DESTE relatório são depois do início da situação?
      return sessoes.every(s => new Date(s.data_sessao + 'T00:00:00') >= dataInicio);
    });
  };

  // ── Mapa de licenças: { irmaoId: Set<sessaoIndex> } ──────────────────────────
  const mapaLicencas = {};
  irmaos.forEach(irmao => {
    const licencas = historicoSituacoes?.filter(sit => {
      if (sit.membro_id !== irmao.id) return false;
      const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return tipo.includes('licen');
    }) || [];
    if (licencas.length === 0) return;

    const indices = new Set();
    sessoes.forEach((sessao, idx) => {
      const ds = new Date(sessao.data_sessao + 'T00:00:00');
      licencas.forEach(lic => {
        const di = new Date(lic.data_inicio + 'T00:00:00');
        const df = lic.data_fim ? new Date(lic.data_fim + 'T00:00:00') : null;
        if (ds >= di && (!df || ds <= df)) indices.add(idx);
      });
    });
    if (indices.size > 0) mapaLicencas[irmao.id] = indices;
  });

  // Índice de linha por irmão (para usar no didDrawCell)
  const rowIrmaoIds = [];

  // Acumulador para o quadro-resumo final (sessões/presenças/ausências por grau)
  const porGrau = { 1: { pres: 0, eleg: 0 }, 2: { pres: 0, eleg: 0 }, 3: { pres: 0, eleg: 0 }, 4: { pres: 0, eleg: 0 } };
  // Taxa individual de cada irmão (com sessão elegível) — para calcular a
  // "Situação Geral" com o MESMO método do Dashboard de Presença (média das
  // % individuais, não soma ponderada por sessão).
  const taxasIndividuais = [];
  const taxasIndividuaisPorGrau = { Aprendiz: [], Companheiro: [], Mestre: [] };

  // Preparar dados dos irmãos — quem não tem NENHUMA responsabilidade no
  // período deste relatório (desligado/irregular/etc. desde antes de toda a
  // janela, sem data de retorno) some da lista por completo. Quem tem parte
  // do período antes da situação continua aparecendo normalmente.
  const rows = irmaos
    .filter(irmao => !naoTemMaisVinculoNoPeriodo(irmao))
    .map(irmao => {
    // ── Rótulo sob o nome ──────────────────────────────────────────
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    let labelNome = '';

    // Prerrogativa por idade (data_prerrogativa <= hoje)
    if (irmao.data_prerrogativa) {
      const dataPrer = new Date(irmao.data_prerrogativa);
      if (hoje >= dataPrer) labelNome = 'Prerrogativa';
    }

    // Licença vigente — verificar no histórico (tipo=licenca, inicio<=hoje, fim ausente ou >=hoje)
    if (!labelNome) {
      const licencaVigente = historicoSituacoes?.find(sit => {
        if (sit.membro_id !== irmao.id) return false;
        const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (!tipo.includes('licen')) return false;
        const di = new Date(sit.data_inicio + 'T00:00:00');
        if (hoje < di) return false;
        if (sit.data_fim) {
          const df = new Date(sit.data_fim + 'T00:00:00');
          return hoje <= df; // vigente: ainda não venceu
        }
        return true; // sem data_fim = licença indefinida
      });
      if (licencaVigente) labelNome = 'Licença';
    }

    // Também verificar campo direto situacao='licenciado' (sem histórico)
    if (!labelNome && irmao.situacao?.toLowerCase() === 'licenciado') {
      labelNome = 'Licença';
    }

    const row = {
      nome: labelNome ? (formatarNome(irmao.nome) + String.fromCharCode(10) + labelNome) : formatarNome(irmao.nome),
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

      // Verificar prerrogativa por idade (≥70 anos na data da sessão)
      if (irmao.data_prerrogativa) {
        const dataPrer = new Date(irmao.data_prerrogativa);
        if (dataSessao >= dataPrer) {
          row[`sessao_${index}`] = '-';
          return; // não computa como elegível
        }
      }

      // Verificar situação via histórico (irregular, suspenso, licença)
      const situacao = verificarSituacaoNaData(irmao.id, dataSessao);
      if (situacao) {
        row[`sessao_${index}`] = '-';
        return; // não computa como elegível
      }

      // NOTA: NÃO verificar campo direto situacao='licenciado' aqui
      // porque ignora a data de início da licença.
      // A licença com data é tratada corretamente via verificarSituacaoNaData acima.

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

      // Acumular no resumo por grau (usa o grau da SESSÃO, não do irmão)
      const idGrauSessao = sessao.grau_sessao_id;
      if (porGrau[idGrauSessao]) porGrau[idGrauSessao].eleg++;

      // Verificar presença
      if (reg?.presente) {
        presencas++;
        row[`sessao_${index}`] = 'P';
        if (porGrau[idGrauSessao]) porGrau[idGrauSessao].pres++;
      } else if (reg?.justificativa) {
        row[`sessao_${index}`] = 'J';
      } else {
        row[`sessao_${index}`] = 'F';
      }
    });

    rowIrmaoIds.push(irmao.id);
    row.total = `${presencas}/${sessoesElegiveis}`;
    row.percentual = sessoesElegiveis > 0 
      ? `${Math.round((presencas / sessoesElegiveis) * 100)}%` 
      : '0%';

    // Guarda a taxa individual (só quem tem sessão elegível) para o cálculo
    // da "Situação Geral" — mesmo método usado no Dashboard de Presença:
    // média das % de cada irmão, não soma ponderada por sessão. Guarda
    // também o grau ATUAL do irmão (sem sobreposição), pra montar o Quadro
    // "Resumo de Presença" por grau com o mesmo método (cada pessoa conta
    // uma única vez, dentro do próprio grau).
    if (sessoesElegiveis > 0) {
      const taxaInd = Math.round((presencas / sessoesElegiveis) * 100);
      taxasIndividuais.push(taxaInd);
      const grauAtual = obterGrauIrmao(irmao) === 'A' ? 'Aprendiz' : obterGrauIrmao(irmao) === 'C' ? 'Companheiro' : 'Mestre';
      taxasIndividuaisPorGrau[grauAtual].push(taxaInd);
    }

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

      // Coluna nome: quando tem label, manter fontSize normal e colorir label
      if (data.column.index === 0 && data.section === 'body' && data.row.index < rows.length - 1) {
        const raw = String(data.cell.raw || '');
        if (raw.includes('Prerrogativa') || raw.includes('Licen')) {
          data.cell.styles.fontSize = 7;
          data.cell.styles.textColor = [10, 36, 99];
        }
      }
      
      // Colunas Total e %
      if (data.column.index >= headers.length - 2) {
        data.cell.styles.fillColor = [220, 240, 255];
        data.cell.styles.fontStyle = 'bold';
        // Cabeçalho: texto preto (fundo claro, texto branco padrão não aparece)
        if (data.section === 'head') {
          data.cell.styles.textColor = [0, 0, 0];
          data.cell.styles.fillColor = [180, 215, 255];
        }
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
    didDrawCell: function(data) {
      if (data.section !== 'body') return;
      const rowIdx = data.row.index;
      if (rowIdx >= rowIrmaoIds.length) return; // linha de total
      const irmaoId = rowIrmaoIds[rowIdx];
      if (!mapaLicencas[irmaoId]) return;

      // Verificar se esta coluna é uma sessão dentro do período de licença
      const sessaoIdx = data.column.index - 2; // offset: col 0=nome, 1=grau
      if (sessaoIdx < 0 || !mapaLicencas[irmaoId].has(sessaoIdx)) return;

      // Desenhar "Lic." no canto inferior esquerdo da célula
      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 36, 99); // azul escuro
      const x = data.cell.x + 0.8;
      const y = data.cell.y + data.cell.height - 1.2;
      doc.text('Lic.', x, y);
      // Restaurar
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(0);
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

  // ── Quadro-resumo final: sessões e presença por grau + geral ──────────────
  const graus = [
    { id: 1, nome: 'Aprendiz' },
    { id: 2, nome: 'Companheiro' },
    { id: 3, nome: 'Mestre' },
    { id: 4, nome: 'Administrativa' },
  ];

  // Quantidade de sessões realizadas por grau (contagem direta, sem depender de elegibilidade)
  const qtdSessoesPorGrau = {};
  sessoes.forEach(s => { qtdSessoesPorGrau[s.grau_sessao_id] = (qtdSessoesPorGrau[s.grau_sessao_id] || 0) + 1; });

  doc.addPage();
  let ySum = 18;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('RESUMO DE PRESENÇA', pageWidth / 2, ySum, { align: 'center' });
  ySum += 10;

  doc.autoTable({
    startY: ySum,
    head: [['Grau', 'Sessões', '% Presença', '% Ausência']],
    body: graus
      .filter(g => (qtdSessoesPorGrau[g.id] || 0) > 0)
      .map(g => {
        const qtd = qtdSessoesPorGrau[g.id] || 0;
        // Administrativa não é um grau de irmão — não tem grupo próprio de
        // pessoas, então mantém o cálculo por vaga/sessão só pra essa linha.
        // Aprendiz/Companheiro/Mestre usam o método por pessoa (cada irmão
        // conta uma única vez, dentro do próprio grau — mesmo método do
        // card geral "Situação Geral da Loja" e do boletim por e-mail).
        let pctPres;
        if (g.nome === 'Administrativa') {
          const d = porGrau[g.id] || { pres: 0, eleg: 0 };
          pctPres = d.eleg > 0 ? Math.round((d.pres / d.eleg) * 100) : 0;
        } else {
          const taxas = taxasIndividuaisPorGrau[g.nome] || [];
          pctPres = taxas.length > 0 ? Math.round(taxas.reduce((s, t) => s + t, 0) / taxas.length) : 0;
        }
        const pctAus = 100 - pctPres;
        return [g.nome, String(qtd), `${pctPres}%`, `${pctAus}%`];
      }),
    theme: 'grid',
    styles: { fontSize: 9, halign: 'center', cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
  });

  ySum = doc.lastAutoTable.finalY + 3;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(
    '* Já exclui automaticamente sessões em que o Irmão tinha prerrogativa de idade ou estava em licença registrada na data.',
    10, ySum, { maxWidth: pageWidth - 20 }
  );
  ySum += 7;

  // Resumo geral — quantidade de SESSÕES (não soma de elegibilidades por irmão)
  const totalSessoesGeral = sessoes.length;
  // % geral = MÉDIA das taxas individuais de cada irmão (mesmo método do
  // Dashboard de Presença), não soma de presenças ÷ soma de elegibilidades.
  const pctPresGeral = taxasIndividuais.length > 0
    ? Math.round(taxasIndividuais.reduce((s, t) => s + t, 0) / taxasIndividuais.length)
    : 0;
  const pctAusGeral  = taxasIndividuais.length > 0 ? 100 - pctPresGeral : 0;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('Situação Geral da Loja', pageWidth / 2, ySum, { align: 'center' });
  ySum += 6;

  doc.autoTable({
    startY: ySum,
    head: [['Qtd. Sessões', '% Presença Geral', '% Ausência Geral']],
    body: [[String(totalSessoesGeral), `${pctPresGeral}%`, `${pctAusGeral}%`]],
    theme: 'grid',
    styles: { fontSize: 10, halign: 'center', fontStyle: 'bold', cellPadding: 4 },
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
  });

  ySum = doc.lastAutoTable.finalY + 12;

  // ── Quadro 3: cruzamento por tipo de sessão × grau do irmão ────────────────
  // Para cada tipo de sessão (Aprendiz/Companheiro/Mestre/Administrativa),
  // mostra quantos irmãos de cada grau existem no quadro e qual a % de
  // presença/ausência deles especificamente nesse tipo de sessão.
  const irmaosContados = rowIrmaoIds
    .map(id => irmaos.find(i => i.id === id))
    .filter(Boolean);

  // Determinar, para cada irmão, se está de fato ATIVO (nem prerrogativa, nem
  // licenciado atualmente) ou EXCLUÍDO da conta (prerrogativa de idade ou
  // licença vigente hoje) — usado tanto pra quantidade quanto pra % de presença.
  const hojeQuadro3 = new Date(); hojeQuadro3.setHours(0, 0, 0, 0);
  const ehExcluidoAtivo = (irmao) => {
    if (irmao.data_prerrogativa) {
      const dataPrer = new Date(irmao.data_prerrogativa);
      if (hojeQuadro3 >= dataPrer) return true;
    }
    const licencaVigente = historicoSituacoes?.some(sit => {
      if (sit.membro_id !== irmao.id) return false;
      const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!tipo.includes('licen')) return false;
      const di = new Date(sit.data_inicio + 'T00:00:00');
      if (hojeQuadro3 < di) return false;
      if (sit.data_fim) { const df = new Date(sit.data_fim + 'T00:00:00'); return hojeQuadro3 <= df; }
      return true;
    });
    if (licencaVigente) return true;
    if (irmao.situacao?.toLowerCase() === 'licenciado') return true;
    return false;
  };

  // Irmão com situação CURRENTE (hoje) de desligado/irregular/suspenso/excluído/
  // ex-ofício não deve contar no roster deste Quadro (nem como ativo, nem
  // como prerrogativa/licença) — ele já entra corretamente na conta de
  // presença/ausência sessão-a-sessão do quadro principal, mas não representa
  // mais um membro "efetivo" do grau hoje.
  const ehInativoHoje = (irmao) => {
    return historicoSituacoes?.some(sit => {
      if (sit.membro_id !== irmao.id) return false;
      const tipo = sit.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const situacoesInativas = ['desligado', 'desligamento', 'irregular', 'suspenso', 'excluido', 'ex-oficio'];
      const ehInativa = situacoesInativas.includes(tipo) || situacoesInativas.some(s => tipo.includes(s));
      if (!ehInativa) return false;
      const di = new Date(sit.data_inicio + 'T00:00:00');
      if (hojeQuadro3 < di) return false;
      if (sit.data_fim) { const df = new Date(sit.data_fim + 'T00:00:00'); return hojeQuadro3 <= df; }
      return true;
    });
  };

  const qtdIrmaosPorGrau = { Aprendiz: { ativos: 0, excluidos: 0 }, Companheiro: { ativos: 0, excluidos: 0 }, Mestre: { ativos: 0, excluidos: 0 } };
  irmaosContados.filter(irmao => !ehInativoHoje(irmao)).forEach(irmao => {
    const g = obterGrauIrmao(irmao);
    const label = g === 'A' ? 'Aprendiz' : g === 'C' ? 'Companheiro' : 'Mestre';
    if (ehExcluidoAtivo(irmao)) qtdIrmaosPorGrau[label].excluidos++;
    else qtdIrmaosPorGrau[label].ativos++;
  });

  // Soma de presenças — apenas dos irmãos considerados ATIVOS
  const presPorTipoSessaoEGrauIrmao = {};
  graus.forEach(g => { presPorTipoSessaoEGrauIrmao[g.id] = { Aprendiz: 0, Companheiro: 0, Mestre: 0 }; });

  irmaosContados.filter(irmao => !ehExcluidoAtivo(irmao) && !ehInativoHoje(irmao)).forEach(irmao => {
    const gIrmao = obterGrauIrmao(irmao);
    const labelIrmao = gIrmao === 'A' ? 'Aprendiz' : gIrmao === 'C' ? 'Companheiro' : 'Mestre';
    sessoes.forEach(sessao => {
      const reg = grade[irmao.id]?.[sessao.id];
      if (reg?.presente && presPorTipoSessaoEGrauIrmao[sessao.grau_sessao_id]) {
        presPorTipoSessaoEGrauIrmao[sessao.grau_sessao_id][labelIrmao]++;
      }
    });
  });

  // Grau numérico mínimo elegível por tipo de sessão — só entram no quadro os
  // graus de irmão que realmente podem participar daquele tipo de sessão
  // (ex: sessão de Companheiro mostra Companheiro+Mestre, não Aprendiz).
  const grauNumerico = { Aprendiz: 1, Companheiro: 2, Mestre: 3 };
  const grauMinimoPorTipoSessao = (grauSessaoId) => grauSessaoId === 4 ? 1 : grauSessaoId;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 95);
  doc.text('FREQUÊNCIA POR GRAU DENTRO DE CADA TIPO DE SESSÃO', pageWidth / 2, ySum, { align: 'center' });
  ySum += 9;

  graus.filter(g => (qtdSessoesPorGrau[g.id] || 0) > 0).forEach(g => {
    const qtdSessoesTipo = qtdSessoesPorGrau[g.id];
    const grauMinimo = grauMinimoPorTipoSessao(g.id);

    // Quebra de página se não houver espaço para o subtítulo + tabela
    if (ySum > pageHeight - 40) {
      doc.addPage();
      ySum = 18;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 95);
    doc.text(`Sessões de ${g.nome} (${qtdSessoesTipo} sess${qtdSessoesTipo === 1 ? 'ão' : 'ões'})`, 10, ySum);
    ySum += 4;

    const linhas = ['Aprendiz', 'Companheiro', 'Mestre']
      .filter(label => grauNumerico[label] >= grauMinimo) // só quem pode participar desse tipo de sessão
      .filter(label => (qtdIrmaosPorGrau[label].ativos + qtdIrmaosPorGrau[label].excluidos) > 0)
      .map(label => {
        const qtdAtivos = qtdIrmaosPorGrau[label].ativos;
        const qtdExcluidos = qtdIrmaosPorGrau[label].excluidos;
        const presSoma = presPorTipoSessaoEGrauIrmao[g.id][label];
        const maximoPossivel = qtdAtivos * qtdSessoesTipo;
        const pctPres = maximoPossivel > 0 ? Math.round((presSoma / maximoPossivel) * 100) : 0;
        const pctAus = maximoPossivel > 0 ? 100 - pctPres : 0;
        return [label, String(qtdAtivos), String(qtdExcluidos), maximoPossivel > 0 ? `${pctPres}%` : '—', maximoPossivel > 0 ? `${pctAus}%` : '—'];
      });

    doc.autoTable({
      startY: ySum,
      head: [['Grau do Irmão', 'Qtd. Ativos', 'Prerrog./Licença', '% Presença', '% Ausência']],
      body: linhas,
      theme: 'grid',
      styles: { fontSize: 9, halign: 'center', cellPadding: 2.5 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      margin: { left: 10, right: 10 },
    });

    ySum = doc.lastAutoTable.finalY + 8;
  });

  ySum += 2;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100);
  doc.text(
    'Observação: ausências de Irmãos com prerrogativa de idade ou em período de licença registrado não são computadas nestes percentuais — apenas sessões efetivamente elegíveis para cada Irmão entram no cálculo.',
    10, ySum, { maxWidth: pageWidth - 20 }
  );

  // Rodapé de TODAS as páginas — corrige a contagem "Página X de Y", já que Y
  // mudou depois que a página de resumo foi adicionada (o didDrawTable da
  // tabela principal não sabia, no momento em que rodou, que teria mais uma
  // página pela frente).
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
