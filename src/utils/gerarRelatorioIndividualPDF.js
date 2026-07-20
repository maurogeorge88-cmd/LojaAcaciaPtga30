import jsPDF from 'jspdf';


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
  let y = 5;

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
  // Se a página já está mais de 60% preenchida, o cabeçalho do próximo ano
  // vai direto para a folha seguinte — evita "Ano XXXX" ficar isolado no
  // rodapé da página com o mês seguinte só aparecendo na próxima.
  const LIMITE_60PC = 297 * 0.6; // 178.2mm (A4 = 297mm)
  const checkNovoAno = () => {
    if (y > LIMITE_60PC) {
      doc.addPage();
      y = 15;
      rodape();
    } else {
      checkPage(20);
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

  // Logo centralizada no topo
  if (dadosLoja?.logo_url) {
    try {
      doc.addImage(dadosLoja.logo_url, 'PNG', (W - 28) / 2, y, 28, 28);
      y += 35;
    } catch(e) { y += 2; }
  }

  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  txt(nomeLoja, W / 2, y, { align: 'center' }); y += 6;
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
    checkNovoAno();

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
      // Só garante espaço pro cabeçalho do mês + cabeçalho de colunas + 1ª linha.
      // As demais linhas, se não couberem, continuam na página seguinte — assim
      // não sobra um espaço grande quando o mês inteiro não cabe de uma vez.
      checkPage(14 + 6.5);

      // Cabeçalho do mês
      doc.setFillColor(219, 234, 254);
      doc.rect(M, y - 3, W - M * 2, 8, 'F');
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
      txt(MESES_NOMES[parseInt(mes)], M + 4, y + 2);
      doc.setTextColor(0);
      y += 8;

      let presMes = 0, elegMes = 0;

      // Cabeçalho das colunas
      const desenharCabecalhoColunas = () => {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80);
        txt('Data', M + 4, y + 2);
        txt('Sessão', M + 28, y + 2);
        txt('Situação', M + 100, y + 2);
        txt('Obs.', M + 142, y + 2);
        linha(y + 4);
        y += 6;
      };
      desenharCabecalhoColunas();

      sessoesMes.forEach((s, idx) => {
        // Quebra a linha para a página seguinte se não couber — repete o
        // nome do mês (continuação) e o cabeçalho de colunas lá.
        if (y + 8 > 270) {
          doc.addPage();
          y = 15;
          rodape();
          doc.setFillColor(219, 234, 254);
          doc.rect(M, y - 3, W - M * 2, 8, 'F');
          doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 64, 175);
          txt(`${MESES_NOMES[parseInt(mes)]} (continuação)`, M + 4, y + 2);
          doc.setTextColor(0);
          y += 8;
          desenharCabecalhoColunas();
        }

        const reg = grade[irmao.id]?.[s.id];
        const dataSessao = new Date(s.data_sessao + 'T00:00:00');

        // ── Grau do irmão NA DATA DA SESSÃO ──────────────────────────────────
        let grauIrmao = 0;
        if (irmao.data_exaltacao && dataSessao >= new Date(irmao.data_exaltacao)) grauIrmao = 3;
        else if (irmao.data_elevacao && dataSessao >= new Date(irmao.data_elevacao)) grauIrmao = 2;
        else if (irmao.data_iniciacao && dataSessao >= new Date(irmao.data_iniciacao)) grauIrmao = 1;

        // ── Grau mínimo da sessão ─────────────────────────────────────────────
        let grauSessao = s.grau_sessao_id || 1;
        if (grauSessao === 4) grauSessao = 1; // ADM = Aprendiz

        // ── Verificar data de ingresso ─────────────────────────────────────────
        const dataIngresso = irmao.data_ingresso_loja
          ? new Date(irmao.data_ingresso_loja + 'T00:00:00')
          : irmao.data_iniciacao ? new Date(irmao.data_iniciacao + 'T00:00:00') : null;
        const antesDoIngresso = dataIngresso && dataSessao < dataIngresso;

        // ── Verificar situação histórica ──────────────────────────────────────
        const situacaoHist = verificarSituacaoNaData(irmao, s.data_sessao, historicoSituacoes);
        const temPrerrogativa = irmao.data_prerrogativa && dataSessao >= new Date(irmao.data_prerrogativa);
        const temLicenca = ehLicenca(situacaoHist);

        // ── Não elegível por grau ou ingresso → "-" sem contar ────────────────
        const naoElegivelGrau = grauSessao > grauIrmao;

        // Determinar situação
        let situacaoLabel = '';
        let corSit = [150, 150, 150];

        if (antesDoIngresso || naoElegivelGrau) {
          situacaoLabel = '-'; // não se aplica
          corSit = [180, 180, 180];
        } else if (temPrerrogativa) {
          situacaoLabel = '-  Prerrogativa';
          corSit = [99, 102, 241];
        } else if (temLicenca) {
          situacaoLabel = '-  Licenca';
          corSit = [245, 158, 11];
        } else if (situacaoHist) {
          situacaoLabel = '-  ' + situacaoHist;
          corSit = [156, 163, 175];
        } else if (reg?.presente) {
          situacaoLabel = 'P  Presente';
          corSit = [5, 150, 105];
          presMes++; elegMes++;
        } else if (reg?.justificativa) {
          situacaoLabel = 'J  Justificado';
          corSit = [217, 119, 6];
          elegMes++;
        } else {
          situacaoLabel = 'F  Ausente';
          corSit = [220, 38, 38];
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
        txt(nomeSessao.substring(0, 42), M + 28, y + 1);

        // Situação colorida
        doc.setFont('helvetica', 'bold'); doc.setTextColor(corSit[0], corSit[1], corSit[2]);
        txt(situacaoLabel, M + 100, y + 1);

        // Justificativa
        if (reg?.justificativa) {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
          doc.setFontSize(7);
          txt(String(reg.justificativa).substring(0, 30), M + 142, y + 1);
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
