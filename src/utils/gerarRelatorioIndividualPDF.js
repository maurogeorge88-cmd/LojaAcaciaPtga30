import jsPDF from 'jspdf';

const LOGO_ACACIA = 'data:image/png;base64,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';

const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtData = (d) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

const obterGrau = (irmao) => {
  if (irmao.mestre_instalado) return 'Mestre Instalado';
  if (irmao.data_exaltacao)   return 'Mestre';
  if (irmao.data_elevacao)    return 'Companheiro';
  return 'Aprendiz';
};

const verificarSituacaoNaData = (irmao, dataSessao, historicoSituacoes) => {
  const sit = historicoSituacoes?.find(s => {
    if (s.membro_id !== irmao.id) return false;
    const tipo = s.tipo_situacao?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const bloqueadoras = ['desligado','desligamento','irregular','suspenso','excluido','ex-oficio','licenca'];
    const ehBloq = bloqueadoras.includes(tipo) || bloqueadoras.some(b => tipo.includes(b));
    if (!ehBloq) return false;
    const di = new Date(s.data_inicio + 'T00:00:00');
    const df = s.data_fim ? new Date(s.data_fim + 'T00:00:00') : null;
    const ds = new Date(dataSessao);
    if (ds < di) return false;
    return df ? ds <= df : true;
  });
  return sit ? sit.tipo_situacao : null;
};

const ehLicenca = (tipo) => {
  if (!tipo) return false;
  const t = tipo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.includes('licen');
};

// ── Função principal ──────────────────────────────────────────────────────────
export const gerarRelatorioIndividualPDF = (
  irmao, sessoes, grade, historicoSituacoes, dadosLoja, dataInicio, dataFim
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15;
  let y = 15;

  // ── Helpers de desenho ──────────────────────────────────────────────────────
  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const linha = (yy) => { doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(M, yy, W - M, yy); };
  const linhaDupla = (yy) => {
    doc.setDrawColor(80); doc.setLineWidth(0.5); doc.line(M, yy, W - M, yy);
    doc.setLineWidth(0.2); doc.line(M, yy + 1, W - M, yy + 1);
  };
  const checkPage = (espaco = 15) => {
    if (y + espaco > 270) {
      doc.addPage();
      y = 15;
      rodape();
    }
  };
  const rodape = () => {
    const totalPg = doc.getNumberOfPages();
    for (let p = 1; p <= totalPg; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
      txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 290);
      txt(`Página ${p} de ${totalPg}`, W / 2, 290, { align: 'center' });
      txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - M, 290, { align: 'right' });
      doc.setTextColor(0);
    }
  };

  // ── CABEÇALHO ───────────────────────────────────────────────────────────────
  const nomeLoja = dadosLoja?.nome || 'ARLS Acácia de Paranatinga nº 30';

  // Logo lado direito
  try { doc.addImage(LOGO_ACACIA, 'PNG', W - M - 25, y - 4, 25, 25); } catch(e) {}

  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  txt(nomeLoja, (W - 30) / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  txt(dadosLoja?.endereco || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 5;
  linhaDupla(y); y += 6;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt('RELATÓRIO INDIVIDUAL DE PRESENÇA', W / 2, y, { align: 'center' }); y += 8;
  linhaDupla(y); y += 6;

  // ── DADOS DO IRMÃO ──────────────────────────────────────────────────────────
  doc.setFillColor(240, 245, 255);
  doc.roundedRect(M, y - 4, W - M * 2, 22, 2, 2, 'F');

  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt(irmao.nome, M + 4, y + 2);

  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60);
  const grau = obterGrau(irmao);
  const campos = [
    irmao.cim ? `CIM: ${irmao.cim}` : null,
    `Grau: ${grau}`,
    irmao.situacao ? `Situação: ${irmao.situacao}` : null,
    irmao.data_iniciacao ? `Iniciação: ${fmtData(irmao.data_iniciacao)}` : null,
  ].filter(Boolean);
  txt(campos.join('   |   '), M + 4, y + 9);

  const periodoLabel = `Período: ${fmtData(dataInicio)} a ${fmtData(dataFim)}`;
  txt(periodoLabel, M + 4, y + 15);
  y += 26;

  // ── Filtrar sessões do período ──────────────────────────────────────────────
  const sessoesPeriodo = sessoes
    .filter(s => s.data_sessao >= dataInicio && s.data_sessao <= dataFim)
    .sort((a, b) => a.data_sessao.localeCompare(b.data_sessao));

  if (sessoesPeriodo.length === 0) {
    doc.setFontSize(10); doc.setTextColor(120);
    txt('Nenhuma sessão encontrada no período selecionado.', W / 2, y + 10, { align: 'center' });
    rodape();
    doc.save(`Presenca_${irmao.nome.replace(/\s+/g, '_')}.pdf`);
    return;
  }

  // ── Agrupar por Ano → Mês ──────────────────────────────────────────────────
  const grupos = {};
  sessoesPeriodo.forEach(s => {
    const d = new Date(s.data_sessao + 'T00:00:00');
    const ano = d.getFullYear();
    const mes = d.getMonth(); // 0-11
    if (!grupos[ano]) grupos[ano] = {};
    if (!grupos[ano][mes]) grupos[ano][mes] = [];
    grupos[ano][mes].push(s);
  });

  // ── Totais globais ──────────────────────────────────────────────────────────
  let totalPres = 0, totalEleg = 0;

  // ── Iterar anos e meses ────────────────────────────────────────────────────
  Object.keys(grupos).sort().forEach(ano => {
    checkPage(20);

    // Cabeçalho do ano
    doc.setFillColor(30, 58, 138);
    doc.rect(M, y - 4, W - M * 2, 10, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255);
    txt(`Ano ${ano}`, M + 4, y + 2);
    doc.setTextColor(0);
    y += 10;

    let totalAno = 0, elegAno = 0;

    Object.keys(grupos[ano]).sort((a, b) => parseInt(a) - parseInt(b)).forEach(mes => {
      const sessoesMes = grupos[ano][mes];
      checkPage(18 + sessoesMes.length * 7);

      // Cabeçalho do mês
      doc.setFillColor(219, 234, 254);
      doc.rect(M, y - 3, W - M * 2, 8, 'F');
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
      txt(MESES_NOMES[parseInt(mes)], M + 4, y + 2);
      doc.setTextColor(0);
      y += 8;

      let presMes = 0, elegMes = 0;

      // Cabeçalho das colunas
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80);
      txt('Data', M + 4, y + 2);
      txt('Sessão', M + 28, y + 2);
      txt('Situação', M + 90, y + 2);
      txt('Obs.', M + 125, y + 2);
      linha(y + 4);
      y += 6;

      sessoesMes.forEach((s, idx) => {
        checkPage(8);

        const reg = grade[irmao.id]?.[s.id];
        const dataSessao = new Date(s.data_sessao + 'T00:00:00');

        // Verificar se é elegível
        const situacaoHist = verificarSituacaoNaData(irmao, s.data_sessao, historicoSituacoes);
        const temPrerrogativa = irmao.data_prerrogativa && dataSessao >= new Date(irmao.data_prerrogativa);
        const temLicenca = ehLicenca(situacaoHist);
        const ehElegivel = !situacaoHist && !temPrerrogativa;

        // Determinar situação
        let situacaoLabel = '';
        let corSit = [0, 0, 0];

        if (temPrerrogativa) {
          situacaoLabel = '-  Prerrogativa';
          corSit = [99, 102, 241]; // roxo
        } else if (temLicenca) {
          situacaoLabel = '-  Licenca';
          corSit = [245, 158, 11]; // âmbar
        } else if (situacaoHist) {
          situacaoLabel = `— ${situacaoHist}`;
          corSit = [156, 163, 175]; // cinza
        } else if (reg?.presente) {
          situacaoLabel = 'P  Presente';
          corSit = [5, 150, 105]; // verde
          presMes++; elegMes++;
        } else if (reg?.justificativa) {
          situacaoLabel = 'J  Justificado';
          corSit = [217, 119, 6]; // âmbar escuro
          elegMes++;
        } else {
          situacaoLabel = 'F  Ausente';
          corSit = [220, 38, 38]; // vermelho
          elegMes++;
        }

        // Linha alternada
        if (idx % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(M, y - 3, W - M * 2, 6.5, 'F');
        }

        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(40);
        txt(fmtData(s.data_sessao), M + 4, y + 1);

        // Nome da sessão — com join ou fallback para grau_sessao_id
        const nomeGrau = s.graus_sessao?.nome || s.grau_sessao || '';
        const nomeClassif = s.classificacoes_sessao?.nome || '';
        const nomeSessao = [nomeGrau, nomeClassif].filter(Boolean).join(' - ');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(40);
        txt(nomeSessao.substring(0, 32), M + 28, y + 1);

        // Situação colorida
        doc.setFont('helvetica', 'bold'); doc.setTextColor(corSit[0], corSit[1], corSit[2]);
        txt(situacaoLabel, M + 90, y + 1);

        // Justificativa
        if (reg?.justificativa) {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
          doc.setFontSize(7);
          txt(String(reg.justificativa).substring(0, 40), M + 125, y + 1);
        }

        doc.setTextColor(0);
        y += 6.5;
      });

      totalAno += presMes;
      elegAno  += elegMes;
      totalPres += presMes;
      totalEleg += elegMes;

      // Totais do mês
      checkPage(10);
      const pctMes = elegMes > 0 ? Math.round((presMes / elegMes) * 100) : 0;
      doc.setFillColor(239, 246, 255);
      doc.rect(M, y - 2, W - M * 2, 8, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      if (pctMes >= 70) doc.setTextColor(5, 150, 105);
      else if (pctMes >= 50) doc.setTextColor(217, 119, 6);
      else doc.setTextColor(220, 38, 38);
      txt(`Total ${MESES_NOMES[parseInt(mes)]}: ${presMes} presença(s) de ${elegMes} sessão(ões) elegíveis — ${pctMes}%`, M + 4, y + 3);
      doc.setTextColor(0);
      y += 10;
    });

    // Totais do ano
    checkPage(12);
    const pctAno = elegAno > 0 ? Math.round((totalAno / elegAno) * 100) : 0;
    doc.setFillColor(30, 58, 138);
    doc.rect(M, y - 2, W - M * 2, 9, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255);
    txt(`Total ${ano}: ${totalAno} presença(s) de ${elegAno} sessão(ões) elegíveis — ${pctAno}%`, M + 4, y + 3.5);
    doc.setTextColor(0);
    y += 13;
  });

  // ── TOTAL GERAL ─────────────────────────────────────────────────────────────
  checkPage(20);
  const pctGeral = totalEleg > 0 ? Math.round((totalPres / totalEleg) * 100) : 0;
  const corGeral = pctGeral >= 70 ? [5, 150, 105] : pctGeral >= 50 ? [217, 119, 6] : [220, 38, 38];

  y += 4;
  linhaDupla(y); y += 6;

  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt('RESULTADO GERAL DO PERÍODO', M, y);
  y += 7;

  doc.setFillColor(240, 253, 244);
  doc.roundedRect(M, y - 3, W - M * 2, 18, 2, 2, 'F');

  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(40);
  txt(`Presenças: ${totalPres}`, M + 6, y + 3);
  txt(`Sessões elegíveis: ${totalEleg}`, M + 6, y + 9);
  txt(`Sessões no período: ${sessoesPeriodo.length}`, M + 6, y + 14);

  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(corGeral[0], corGeral[1], corGeral[2]);
  txt(`${pctGeral}%`, W - M - 6, y + 10, { align: 'right' });

  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  txt('Taxa de Presença', W - M - 6, y + 15, { align: 'right' });
  y += 22;

  rodape();
  doc.save(`Presenca_${irmao.nome.replace(/\s+/g, '_')}_${dataInicio}_${dataFim}.pdf`);
};
