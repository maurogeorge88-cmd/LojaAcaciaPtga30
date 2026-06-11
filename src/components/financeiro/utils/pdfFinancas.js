import { formatarDataBR } from './formatadores';

const meses = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export async function gerarRelatorioMovimentacao({ movForm, irmaos, supabase, showSuccess, showError }) {
  const { irmaoId, dataInicio, dataFim } = movForm;
  if (!irmaoId) { showError('Selecione um irmão.'); return; }
  if (!dataInicio || !dataFim) { showError('Informe o período.'); return; }
  if (dataInicio > dataFim) { showError('Data início deve ser anterior ao fim.'); return; }
  try {
    showSuccess('Gerando relatório de movimentação...');

    const { data: dadosLoja } = await supabase.from('dados_loja').select('*').single();
    const { data: irmaoData } = await supabase
      .from('irmaos').select('nome, cpf, cim').eq('id', irmaoId).single();

    // ── Buscar lançamentos com vencimento ANTERIOR ao período ─────────────
    // Pendentes: formam o saldo devedor anterior
    const { data: lancsAntPend } = await supabase
      .from('lancamentos_loja')
      .select('*, categorias_financeiras(nome, tipo)')
      .eq('origem_irmao_id', irmaoId)
      .eq('status', 'pendente')
      .lt('data_vencimento', dataInicio)
      .order('data_vencimento');

    // Para exibir no bloco de saldo anterior
    const lancsAnt = lancsAntPend || [];

    // ── Buscar parcelas futuras (pendentes após o período) ──────────────
    const { data: lancsFuturos } = await supabase
      .from('lancamentos_loja')
      .select('*, categorias_financeiras(nome, tipo)')
      .eq('origem_irmao_id', irmaoId)
      .eq('status', 'pendente')
      .gt('data_vencimento', dataFim)
      .order('data_vencimento');

    // ── Buscar lançamentos DO período ────────────────────────────────────
    const { data: lancsPeriodo } = await supabase
      .from('lancamentos_loja')
      .select('*, categorias_financeiras(nome, tipo)')
      .eq('origem_irmao_id', irmaoId)
      .or(
        'and(status.eq.pago,data_pagamento.gte.' + dataInicio + ',data_pagamento.lte.' + dataFim + '),' +
        'and(status.eq.pendente,data_vencimento.gte.' + dataInicio + ',data_vencimento.lte.' + dataFim + ')'
      )
      .order('data_vencimento');

    const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const fmtR = (v) => 'R$ ' + Math.abs(parseFloat(v || 0)).toFixed(2);
    const soma = (arr) => arr.reduce((s, l) => s + parseFloat(l.valor || 0), 0);

    // Saldo anterior: pendentes de receita (irmão devia) - pendentes de despesa (loja devia)
    const antDesp = lancsAnt.filter(l => l.categorias_financeiras?.tipo === 'receita');
    const antRec  = lancsAnt.filter(l => l.categorias_financeiras?.tipo === 'despesa');
    const saldoAntDesp = soma(antDesp);  // irmão devia antes
    const saldoAntRec  = soma(antRec);   // loja devia antes
    const saldoAnt = saldoAntDesp - saldoAntRec; // + = irmão deve, - = loja deve

    // Período: separar por tipo e status
    const periodo = lancsPeriodo || [];
    const despPagas    = periodo.filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pago');
    const despPend     = periodo.filter(l => l.categorias_financeiras?.tipo === 'receita' && l.status === 'pendente');
    const recPagas     = periodo.filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pago');
    const recPend      = periodo.filter(l => l.categorias_financeiras?.tipo === 'despesa' && l.status === 'pendente');

    // Parcelas futuras — só irmão→loja (receita) para exibição informativa
    const parcFuturas = (lancsFuturos || []).filter(l => l.categorias_financeiras?.tipo === 'receita');

    const totDespPagas = soma(despPagas);
    const totDespPend  = soma(despPend);
    const totRecPagas  = soma(recPagas);
    const totRecPend   = soma(recPend);

    // Resultado final: o que irmão deve AGORA
    // = saldo anterior (devedor) + pendentes do período (irmão → loja) - receitas pendentes (loja → irmão)
    const valorAPagar   = (saldoAnt > 0 ? saldoAnt : 0) + totDespPend;
    const valorAReceber = (saldoAnt < 0 ? Math.abs(saldoAnt) : 0) + totRecPend;
    const resultadoFinal = valorAPagar - valorAReceber;

    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    const doc = new jsPDF();
    let y = 10;

    const checkPage = (esp = 15) => { if (y + esp > 275) { doc.addPage(); y = 15; } };

    const rodape = () => {
      const tot = doc.getNumberOfPages();
      for (let p = 1; p <= tot; p++) {
        doc.setPage(p);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
        doc.text('SysMaçom-MG — Desenvolvedor: Mauro George', 15, 290);
        doc.text('Página ' + p + ' de ' + tot, 105, 290, { align: 'center' });
        doc.text('Emitido em ' + new Date().toLocaleDateString('pt-BR'), 195, 290, { align: 'right' });
        doc.setTextColor(0);
      }
    };

    // ── Logo ──────────────────────────────────────────────────────────────
    if (dadosLoja?.logo_url) {
      try { doc.addImage(dadosLoja.logo_url, 'PNG', 88, y, 30, 30); y += 35; } catch {}
    }

    // ── Cabeçalho ─────────────────────────────────────────────────────────
    const nomeLoja = (dadosLoja?.nome_loja || 'ARLS Acácia de Paranatinga') + ' Nº ' + (dadosLoja?.numero_loja || '30');
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text(nomeLoja, 105, y, { align: 'center' }); y += 6;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Jurisdicionada a Grande Loja Maçônica do Estado de Mato Grosso', 105, y, { align: 'center' }); y += 7;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Extrato de Movimentação Financeira', 105, y, { align: 'center' }); y += 10;

    // ── Dados do irmão ────────────────────────────────────────────────────
    doc.setFillColor(240, 240, 240); doc.rect(15, y, 180, 22, 'F');
    y += 5;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Irmão:', 18, y); doc.setFont('helvetica', 'bold'); doc.text(irmaoData.nome, 35, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('CIM: ' + (irmaoData.cim || '—'), 18, y);
    doc.text('CPF: ' + (irmaoData.cpf || '—'), 60, y);
    doc.text('Período: ' + fmtData(dataInicio) + ' a ' + fmtData(dataFim), 115, y);
    y += 16;

    // ── Função renderBloco ────────────────────────────────────────────────
    const renderBloco = (titulo, lancs, corTitulo, corValor, semStatus, isPagos) => {
      if (!lancs.length) return 0;
      checkPage(20);

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...corTitulo);
      doc.text(titulo, 15, y); y += 3;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;

      doc.setFillColor(230, 230, 230); doc.rect(15, y, 180, 6, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text(isPagos ? 'DtPag' : 'DtLanc', 17, y + 4);
      doc.text('DtVenc', 43, y + 4);
      doc.text('Descricao', 69, y + 4);
      if (!semStatus) doc.text('Status', 148, y + 4);
      doc.text('Valor', 192, y + 4, { align: 'right' });
      y += 11;

      let subtotal = 0;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      lancs.forEach(lanc => {
        checkPage(8);
        const dataLanc = fmtData(lanc.data_pagamento || lanc.data_lancamento || lanc.data_vencimento);
        const dataVenc = fmtData(lanc.data_vencimento);
        const desc = (lanc.descricao || '').substring(0, 38);
        const valor = parseFloat(lanc.valor || 0);
        subtotal += valor;
        doc.setTextColor(0);
        doc.text(dataLanc, 17, y);
        doc.text(dataVenc, 43, y);
        doc.text(desc, 69, y);
        if (!semStatus) {
          if (lanc.status === 'pago') { doc.setTextColor(16, 120, 60); doc.text('Pago', 148, y); }
          else { doc.setTextColor(200, 80, 0); doc.text('Pendente', 148, y); }
        }
        doc.setTextColor(...corValor);
        doc.text(fmtR(valor), 192, y, { align: 'right' });
        doc.setTextColor(0);
        y += 5;
      });

      y += 1;
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 5;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Sub Total ' + titulo + ':', 140, y, { align: 'right' });
      // Subtotal azul para blocos pagos, mantém cor original para pendentes
      doc.setTextColor(...(isPagos ? [0, 80, 180] : corValor));
      doc.text(fmtR(subtotal), 192, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y);
      y += 14;
      doc.setTextColor(0);
      return subtotal;
    };

    // ── Saldo Anterior ────────────────────────────────────────────────────
    if (lancsAnt && lancsAnt.length > 0) {
      checkPage(20);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 40, 150);
      doc.text('Saldo Anterior - Pendencias antes de ' + fmtData(dataInicio), 15, y); y += 3;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;

      doc.setFillColor(230, 230, 240); doc.rect(15, y, 180, 6, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('DtVenc', 17, y + 4); doc.text('Descrição', 50, y + 4); doc.text('Tipo', 148, y + 4);
      doc.text('Valor', 192, y + 4, { align: 'right' });
      y += 11;

      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      lancsAnt.forEach(lanc => {
        checkPage(8);
        const tipo = lanc.categorias_financeiras?.tipo === 'receita' ? 'Deve' : 'A Receber';
        const cor = lanc.categorias_financeiras?.tipo === 'receita' ? [200, 0, 0] : [0, 80, 180];
        doc.setTextColor(0);
        doc.text(fmtData(lanc.data_vencimento), 17, y);
        doc.text((lanc.descricao || '').substring(0, 50), 50, y);
        doc.setTextColor(...cor); doc.text(tipo, 148, y);
        doc.text(fmtR(lanc.valor), 192, y, { align: 'right' });
        doc.setTextColor(0);
        y += 5;
      });

      y += 1;
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, y, 195, y); y += 5;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Saldo Anterior:', 140, y, { align: 'right' });
      if (saldoAnt > 0) { doc.setTextColor(200, 0, 0); doc.text('Deve ' + fmtR(saldoAnt), 192, y, { align: 'right' }); }
      else if (saldoAnt < 0) { doc.setTextColor(0, 80, 180); doc.text('A Receber ' + fmtR(saldoAnt), 192, y, { align: 'right' }); }
      else { doc.setTextColor(0, 150, 80); doc.text('Em Dia', 192, y, { align: 'right' }); }
      y += 2;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y);
      y += 14; doc.setTextColor(0);
    }

    // ── Blocos do período ──────────────────────────────────────────────────
    renderBloco('Despesas Pagas (Irmao com a Loja)', despPagas, [0, 80, 180], [200, 0, 0], true, true);
    renderBloco('Despesas Pendentes (Irmao com a Loja)', despPend, [200, 60, 0], [220, 60, 0], true, false);
    // Parcelas futuras — apenas informativo, sem subtotal no resumo
    if (parcFuturas.length > 0) {
      checkPage(20);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text('Parcelas Futuras - Irmao com a Loja (informativo)', 15, y); y += 3;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y); y += 4;

      doc.setFillColor(240, 240, 240); doc.rect(15, y, 180, 6, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('DtVenc', 17, y + 4);
      doc.text('Descricao', 50, y + 4);
      doc.text('Parcela', 148, y + 4);
      doc.text('Valor', 192, y + 4, { align: 'right' });
      y += 11;

      let totFut = 0;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      parcFuturas.forEach(lanc => {
        checkPage(8);
        const parc = lanc.numero_parcela && lanc.total_parcelas
          ? lanc.numero_parcela + '/' + lanc.total_parcelas : '—';
        totFut += parseFloat(lanc.valor || 0);
        doc.setTextColor(0);
        doc.text(fmtData(lanc.data_vencimento), 17, y);
        doc.text((lanc.descricao || '').substring(0, 50), 50, y);
        doc.setTextColor(100, 100, 100); doc.text(parc, 148, y);
        doc.setTextColor(150, 0, 0); doc.text(fmtR(totFut - (totFut - parseFloat(lanc.valor || 0))), 192, y, { align: 'right' });
        doc.setTextColor(0);
        y += 5;
      });

      y += 1;
      doc.setDrawColor(100); doc.setLineWidth(0.4); doc.line(15, y, 195, y); y += 5;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text('Total Parcelas Futuras (informativo):', 140, y, { align: 'right' });
      doc.text(fmtR(totFut), 192, y, { align: 'right' });
      y += 2;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, y, 195, y);
      y += 14; doc.setTextColor(0);
    }

    renderBloco('Receitas Pagas (Loja com o Irmao)', recPagas, [0, 80, 180], [0, 100, 200], true, true);
    renderBloco('Receitas Pendentes (Loja com o Irmao)', recPend, [80, 0, 180], [100, 0, 200], true, false);

    // ── Resumo Geral ───────────────────────────────────────────────────────
    checkPage(55);
    const yBanco = y;

    // Dados bancários (esquerda)
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('Dados Bancários', 45, y, { align: 'center' }); y += 5;
    doc.setFontSize(9); doc.setTextColor(0, 100, 180); doc.setFont('helvetica', 'bold');
    doc.text('Cooperativa de Crédito Sicredi', 45, y, { align: 'center' }); y += 4;
    doc.setTextColor(0); doc.setFont('helvetica', 'normal');
    doc.text('Ag.: 0802 - C.C.: 86.913-9', 45, y, { align: 'center' }); y += 4;
    doc.text('PIX.: 03.250.704/0001-00', 45, y, { align: 'center' }); y += 4;
    doc.setFontSize(8); doc.text('CNPJ: 03.250.704/0001-00', 45, y, { align: 'center' }); y += 4;
    doc.text('Fav.: ARLSACACIA PARANATINGA 30', 45, y, { align: 'center' });

    // Resumo (direita)
    let yr = yBanco;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text('Resumo Geral:', 192, yr, { align: 'right' }); yr += 7;

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    if (saldoAnt !== 0) {
      if (saldoAnt > 0) { doc.setTextColor(200, 0, 0); doc.text('(+) Saldo Anterior (deve):', 155, yr, { align: 'right' }); doc.text(fmtR(saldoAnt), 192, yr, { align: 'right' }); }
      else { doc.setTextColor(0, 80, 180); doc.text('(-) Saldo Anterior (a receber):', 155, yr, { align: 'right' }); doc.text(fmtR(saldoAnt), 192, yr, { align: 'right' }); }
      yr += 5;
    }
    doc.setTextColor(160, 0, 0);
    doc.text('(+) Desp. Pendentes:', 155, yr, { align: 'right' }); doc.text(fmtR(totDespPend), 192, yr, { align: 'right' }); yr += 5;
    doc.setTextColor(0, 80, 180);
    doc.text('(-) Rec. Pendentes:', 155, yr, { align: 'right' }); doc.text(fmtR(totRecPend), 192, yr, { align: 'right' }); yr += 5;

    // Informativos (não entram no cálculo)
    doc.setTextColor(120);
    doc.text('Desp. Pagas (info):', 155, yr, { align: 'right' }); doc.text(fmtR(totDespPagas), 192, yr, { align: 'right' }); yr += 5;
    doc.text('Rec. Pagas (info):', 155, yr, { align: 'right' }); doc.text(fmtR(totRecPagas), 192, yr, { align: 'right' }); yr += 3;

    doc.setTextColor(0); doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(115, yr, 195, yr); yr += 6;

    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    if (resultadoFinal > 0) {
      doc.setTextColor(200, 0, 0);
      doc.text('Valor a Pagar:', 155, yr, { align: 'right' });
      doc.text(fmtR(resultadoFinal), 192, yr, { align: 'right' });
    } else if (resultadoFinal < 0) {
      doc.setTextColor(0, 80, 180);
      doc.text('Valor a Receber:', 155, yr, { align: 'right' });
      doc.text(fmtR(resultadoFinal), 192, yr, { align: 'right' });
    } else {
      doc.setTextColor(0, 150, 80);
      doc.text('Situação: Em Dia', 155, yr, { align: 'right' });
    }
    doc.setTextColor(0);

    rodape();
    doc.save('Movimentacao_' + irmaoData.nome.replace(/\s+/g, '_') + '.pdf');
    showSuccess('Relatório gerado!');
  } catch (e) {
    showError('Erro: ' + e.message);
  }
}

export async function gerarRelatorioIndividual(irmaoId, comPresenca = false, { meses, supabase, showSuccess, showError }) {
  try {
    showSuccess('Gerando relatório individual...');
    
    // Buscar dados da loja
    const { data: dadosLoja } = await supabase
      .from('dados_loja')
      .select('*')
      .single();
    
    const { data: irmaoData, error: irmaoError } = await supabase
      .from('irmaos')
      .select('nome, cpf, cim, data_iniciacao, data_elevacao, data_exaltacao')
      .eq('id', irmaoId)
      .single();

    if (irmaoError) throw irmaoError;

    const { data: lancsData, error: lancsError } = await supabase
      .from('lancamentos_loja')
      .select(`
        *,
        categorias_financeiras(nome, tipo)
      `)
      .eq('origem_irmao_id', irmaoId)
      .eq('status', 'pendente')
      .order('data_vencimento');

    // Separar: lançamentos com vencimento hoje ou antes = pendentes normais
    //           lançamentos com vencimento futuro = parcelas futuras (bloco separado)
    const hojeDt = new Date();
    const hojeStr = hojeDt.getFullYear() + '-' + String(hojeDt.getMonth()+1).padStart(2,'0') + '-' + String(hojeDt.getDate()).padStart(2,'0');
    const parcFuturasInd = (lancsData || []).filter(l =>
      l.categorias_financeiras?.tipo === 'receita' && l.data_vencimento > hojeStr
    );
    // Remover parcelas futuras do lancsData para não aparecerem no bloco Despesa
    const lancsDataFiltrado = (lancsData || []).filter(l => l.data_vencimento <= hojeStr);

    if (lancsError) throw lancsError;

    if ((!lancsData || lancsData.length === 0)) {
      showError('Este irmão não possui lançamentos pendentes!');
      return;
    }

    // BUSCAR ÚLTIMAS 5 SESSÕES COM PRESENÇA DO IRMÃO
    const { data: ultimasSessoesTemp } = await supabase
      .from('sessoes_presenca')
      .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome)')
      .lte('data_sessao', new Date().toISOString().split('T')[0]) // Não incluir sessões futuras
      .order('data_sessao', { ascending: false })
      .limit(5);
    
    // Inverter para ordem crescente (da mais antiga para a mais recente)
    const ultimasSessoes = ultimasSessoesTemp?.reverse() || [];

    const { data: presencas } = await supabase
      .from('registros_presenca')
      .select('*')
      .eq('membro_id', irmaoId)
      .in('sessao_id', ultimasSessoes?.map(s => s.id) || []);

    // Organizar por mês/ano (apenas pendentes com vencimento até hoje)
    const lancsPorMes = {};
    lancsDataFiltrado.forEach(lanc => {
      const data = new Date(lanc.data_vencimento + 'T00:00:00');
      const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
      const mesNome = meses[data.getMonth()];
      
      if (!lancsPorMes[mesAno]) {
        lancsPorMes[mesAno] = {
          mesNome,
          mes: data.getMonth() + 1,
          ano: data.getFullYear(),
          lancamentos: []
        };
      }
      
      lancsPorMes[mesAno].lancamentos.push(lanc);
    });

    // Importar jsPDF dinamicamente
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    const doc = new jsPDF();
    let yPos = 10;

    // Rodapé local para este relatório
    const rodape = () => {
      const tot = doc.getNumberOfPages();
      for (let p = 1; p <= tot; p++) {
        doc.setPage(p);
        doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(150);
        doc.text('SysMaçom-MG - Desenvolvedor: Mauro George', 15, 290);
        doc.text('Página ' + p + ' de ' + tot, 105, 290, { align: 'center' });
        doc.text('Emitido em ' + new Date().toLocaleDateString('pt-BR'), 195, 290, { align: 'right' });
        doc.setTextColor(0);
      }
    };

    // ========================================
    // LOGO
    // ========================================
    if (dadosLoja?.logo_url) {
      try {
        doc.addImage(dadosLoja.logo_url, 'PNG', 90, yPos, 30, 30);
        yPos += 38; // Aumentado para 38
      } catch (e) {
        console.log('Logo não disponível');
      }
    }
    
    // Cabeçalho
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const nomeLoja = `${dadosLoja?.nome_loja || 'ARLS ACACIA DE PARANATINGA'} Nº ${dadosLoja?.numero_loja || '30'}`;
    doc.text(nomeLoja, 105, yPos, { align: 'center' });
    yPos += 6;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Despesas Pendentes', 105, yPos, { align: 'center' });
    yPos += 10;

    // Dados do Irmão — nome + CPF + CIM na mesma linha se couber
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos, 180, 12, 'F');
    yPos += 7;
    doc.setFontSize(9);

    // Nome
    doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
    doc.text('Nome:', 18, yPos);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text(irmaoData.nome, 31, yPos);

    // CPF após nome
    const xCpf = 31 + doc.getTextWidth(irmaoData.nome) + 8;
    const cpfTxt = 'CPF: ' + (irmaoData.cpf || '—');
    const xCim = xCpf + doc.getTextWidth(cpfTxt) + 8;
    const cimTxt = 'CIM: ' + (irmaoData.cim || '—');

    doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
    if (xCim + doc.getTextWidth(cimTxt) < 195) {
      doc.text(cpfTxt, xCpf, yPos);
      doc.text(cimTxt, xCim, yPos);
    } else if (xCpf + doc.getTextWidth(cpfTxt) < 195) {
      doc.text(cpfTxt, xCpf, yPos);
      yPos += 5; doc.text(cimTxt, 31, yPos);
    } else {
      yPos += 5; doc.text(cpfTxt + '   ' + cimTxt, 18, yPos);
    }
    doc.setTextColor(0);
    yPos += 8;

    // Totalizadores
    let totalGeralDespesa = 0;
    let totalGeralCredito = 0;

    // Determinar o último mês de despesas pendentes (tipo receita = irmão deve)
    const todasDesp = lancsDataFiltrado.filter(l => l.categorias_financeiras?.tipo === 'receita');
    const ultimoMesDesp = todasDesp.length > 0
      ? todasDesp.map(l => l.data_vencimento.substring(0,7)).sort().pop() // 'YYYY-MM' mais recente
      : null;

    // Saldo Anterior: despesas de meses ANTES do último mês
    const lancsAntInd   = ultimoMesDesp
      ? todasDesp.filter(l => l.data_vencimento.substring(0,7) < ultimoMesDesp)
      : [];
    // Despesas do último mês (quadro isolado)
    const lancsUltMes   = ultimoMesDesp
      ? todasDesp.filter(l => l.data_vencimento.substring(0,7) === ultimoMesDesp)
      : todasDesp;

    // Receitas pendentes (loja deve ao irmão) — sem separação
    const lancsDespesa = lancsDataFiltrado.filter(l => l.categorias_financeiras?.tipo === 'despesa');

    // Manter lancsReceita apontando para despesas do último mês (usado no renderBloco Despesa)
    const lancsReceita = lancsUltMes;

    const antDespInd   = lancsAntInd;
    const antRecInd    = lancsAntInd.filter(l => l.categorias_financeiras?.tipo === 'despesa'); // vazio, por precaução
    const somaAntDesp  = antDespInd.reduce((s,l) => s + parseFloat(l.valor||0), 0);
    const somaAntRec   = antRecInd.reduce((s,l) => s + parseFloat(l.valor||0), 0);
    const saldoAntInd  = somaAntDesp - somaAntRec;

    // Label do último mês
    const nomeMesesInd = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const labelUltMes  = ultimoMesDesp
      ? nomeMesesInd[parseInt(ultimoMesDesp.substring(5,7))-1] + '/' + ultimoMesDesp.substring(0,4)
      : 'Mês Atual';

    // ── Função auxiliar para renderizar bloco de lançamentos ──────────────
    const renderBloco = (titulo, lancamentos, corTitulo, corValor) => {
      if (lancamentos.length === 0) return 0;
      if (yPos > 220) { doc.addPage(); yPos = 20; }

      // Título em negrito
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...corTitulo);
      doc.text(titulo, 15, yPos);
      yPos += 2;

      // Linha separadora abaixo do título
      doc.setDrawColor(150); doc.setLineWidth(0.3);
      doc.line(15, yPos, 195, yPos);
      yPos += 4;

      // Cabeçalho colunas
      doc.setFillColor(230, 230, 230);
      doc.rect(15, yPos, 180, 6, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text('DtLanc', 17, yPos + 4);
      doc.text('DtVenc', 42, yPos + 4);
      doc.text('Descrição', 67, yPos + 4);
      doc.text('Valor', 190, yPos + 4, { align: 'right' });
      yPos += 11;

      let subtotal = 0;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');

      lancamentos.forEach(lanc => {
        if (yPos > 275) { doc.addPage(); yPos = 20; }
        const dataLanc = formatarDataBR(lanc.data_lancamento || lanc.data_vencimento);
        const dataVenc = formatarDataBR(lanc.data_vencimento);
        const desc = (lanc.descricao || '').substring(0, 42);
        const valor = parseFloat(lanc.valor || 0);
        subtotal += valor;

        doc.setTextColor(0, 0, 0);
        doc.text(dataLanc, 17, yPos);
        doc.text(dataVenc, 42, yPos);
        doc.text(desc, 67, yPos);
        doc.setTextColor(...corValor);
        doc.text('R$ ' + valor.toFixed(2), 190, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        yPos += 5;
      });

      // Linha separadora + subtotal
      yPos += 1;
      doc.setDrawColor(0); doc.setLineWidth(0.5);
      doc.line(15, yPos, 195, yPos);
      yPos += 5;

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text('Sub Total ' + titulo + ':', 130, yPos, { align: 'right' });
      doc.setTextColor(...corValor);
      doc.text('R$ ' + subtotal.toFixed(2), 190, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);

      yPos += 2;
      doc.setDrawColor(150); doc.setLineWidth(0.3);
      doc.line(15, yPos, 195, yPos);
      yPos += 14;

      return subtotal;
    };

    // ── Saldo Anterior ────────────────────────────────────────────────────
    if (lancsAntInd.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; }

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 40, 150);
      doc.text('Saldo Anterior - Pendencias de meses anteriores', 15, yPos); yPos += 3;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, yPos, 195, yPos); yPos += 4;

      doc.setFillColor(230, 225, 245); doc.rect(15, yPos, 180, 6, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('DtVenc', 17, yPos + 4);
      doc.text('Descricao', 50, yPos + 4);
      doc.text('Tipo', 155, yPos + 4);
      doc.text('Valor', 192, yPos + 4, { align: 'right' });
      yPos += 11;

      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      lancsAntInd.forEach(lanc => {
        if (yPos > 275) { doc.addPage(); yPos = 20; }
        const tipo  = lanc.categorias_financeiras?.tipo === 'receita' ? 'Deve' : 'A Receber';
        const cor   = lanc.categorias_financeiras?.tipo === 'receita' ? [200, 0, 0] : [0, 80, 180];
        const fmtDtInd = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        doc.setTextColor(0);
        doc.text(fmtDtInd(lanc.data_vencimento), 17, yPos);
        doc.text((lanc.descricao || '').substring(0, 50), 50, yPos);
        doc.setTextColor(...cor); doc.text(tipo, 155, yPos);
        doc.setTextColor(200, 0, 0); doc.text('R$ ' + parseFloat(lanc.valor||0).toFixed(2), 192, yPos, { align: 'right' });
        doc.setTextColor(0);
        yPos += 5;
      });

      yPos += 1;
      doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15, yPos, 195, yPos); yPos += 5;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('Saldo Anterior:', 140, yPos, { align: 'right' });
      if (saldoAntInd > 0) { doc.setTextColor(200, 0, 0); doc.text('Deve R$ ' + saldoAntInd.toFixed(2), 192, yPos, { align: 'right' }); }
      else if (saldoAntInd < 0) { doc.setTextColor(0, 80, 180); doc.text('A Receber R$ ' + Math.abs(saldoAntInd).toFixed(2), 192, yPos, { align: 'right' }); }
      else { doc.setTextColor(0, 150, 80); doc.text('Em Dia', 192, yPos, { align: 'right' }); }
      yPos += 2;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, yPos, 195, yPos);
      yPos += 12; doc.setTextColor(0);
    }

    // Renderizar blocos
    totalGeralDespesa = renderBloco('Despesa - ' + labelUltMes, lancsReceita, [180, 0, 0], [200, 0, 0]);

    // ── Parcelas Futuras ─────────────────────────────────────────────────
    if (parcFuturasInd.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; }

      // Título com "INFORMATIVO" destacado
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text('Parcelas Futuras - Irmao com a Loja  ', 15, yPos);
      const largTitulo = doc.getTextWidth('Parcelas Futuras - Irmao com a Loja  ');
      doc.setTextColor(200, 100, 0);
      doc.text('[ INFORMATIVO ]', 15 + largTitulo, yPos);
      yPos += 3;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, yPos, 195, yPos); yPos += 4;

      doc.setFillColor(245, 240, 225); doc.rect(15, yPos, 180, 6, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text('DtVenc', 17, yPos + 4);
      doc.text('Descricao', 50, yPos + 4);
      doc.text('Parcela', 155, yPos + 4);
      doc.text('Valor', 192, yPos + 4, { align: 'right' });
      yPos += 11;

      let totFutInd = 0;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
      parcFuturasInd.forEach(lanc => {
        if (yPos > 275) { doc.addPage(); yPos = 20; }
        const parc = lanc.numero_parcela && lanc.total_parcelas
          ? lanc.numero_parcela + '/' + lanc.total_parcelas : '—';
        const valor = parseFloat(lanc.valor || 0);
        totFutInd += valor;
        doc.setTextColor(0);
        doc.text(new Date(lanc.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR'), 17, yPos);
        doc.text((lanc.descricao || '').substring(0, 52), 50, yPos);
        doc.setTextColor(100, 100, 100); doc.text(parc, 155, yPos);
        doc.setTextColor(150, 80, 0); doc.text('R$ ' + valor.toFixed(2), 192, yPos, { align: 'right' });
        doc.setTextColor(0);
        yPos += 5;
      });

      yPos += 1;
      doc.setDrawColor(120); doc.setLineWidth(0.4); doc.line(15, yPos, 195, yPos); yPos += 5;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text('Total Parcelas Futuras', 140, yPos, { align: 'right' });
      doc.setTextColor(200, 100, 0); doc.setFont('helvetica', 'bold');
      doc.text('[ INFORMATIVO ]', 141, yPos);
      doc.text('R$ ' + totFutInd.toFixed(2), 192, yPos, { align: 'right' });
      yPos += 2;
      doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(15, yPos, 195, yPos);
      yPos += 12; doc.setTextColor(0);
    }

    totalGeralCredito = renderBloco('Receita', lancsDespesa, [0, 80, 180], [0, 80, 180]);

    // ── Resumo Geral ──────────────────────────────────────────────────────
    if (yPos > 230) { doc.addPage(); yPos = 20; }

    // Incluir saldo anterior no total geral
    totalGeralDespesa += somaAntDesp;
    totalGeralCredito += somaAntRec;
    const saldoFinal = totalGeralDespesa - totalGeralCredito;

    // Dados bancários (lado esquerdo)
    const ybanco = yPos;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
    doc.text('Dados Bancários', 45, yPos, { align: 'center' });
    yPos += 5;
    doc.setFontSize(9); doc.setTextColor(0, 100, 180); doc.setFont('helvetica', 'bold');
    doc.text('Cooperativa de Crédito Sicredi', 45, yPos, { align: 'center' });
    yPos += 4;
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
    doc.text('Ag.: 0802 - C.C.: 86.913-9', 45, yPos, { align: 'center' });
    yPos += 4;
    doc.text('PIX.: 03.250.704/0001-00', 45, yPos, { align: 'center' });
    yPos += 4;
    doc.setFontSize(8);
    doc.text('CNPJ: 03.250.704/0001-00', 45, yPos, { align: 'center' });
    yPos += 4;
    doc.text('Fav.: ARLSACACIA PARANATINGA 30', 45, yPos, { align: 'center' });

    // Resumo geral (lado direito)
    let yr = ybanco;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');

    // Título Resumo Geral
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo Geral:', 190, yr, { align: 'right' });
    yr += 6;

    doc.setFontSize(10);
    doc.text('Despesa Total:', 155, yr, { align: 'right' });
    doc.setTextColor(200, 0, 0);
    doc.text('R$ ' + totalGeralDespesa.toFixed(2), 190, yr, { align: 'right' });
    yr += 5;

    doc.setTextColor(0, 0, 0);
    doc.text('Receita Total:', 155, yr, { align: 'right' });
    doc.setTextColor(0, 80, 180);
    doc.text('R$ ' + totalGeralCredito.toFixed(2), 190, yr, { align: 'right' });
    yr += 2;

    // Linha separadora antes do saldo final
    doc.setDrawColor(0); doc.setLineWidth(0.5);
    doc.line(115, yr, 195, yr);
    yr += 5;

    // Valor a Pagar ou Valor a Receber
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    if (saldoFinal > 0) {
      // Irmão deve para a loja
      doc.setTextColor(200, 0, 0);
      doc.text('Valor a Pagar:', 155, yr, { align: 'right' });
      doc.text('R$ ' + saldoFinal.toFixed(2), 190, yr, { align: 'right' });
    } else if (saldoFinal < 0) {
      // Loja deve para o irmão
      doc.setTextColor(0, 80, 180);
      doc.text('Valor a Receber:', 155, yr, { align: 'right' });
      doc.text('R$ ' + Math.abs(saldoFinal).toFixed(2), 190, yr, { align: 'right' });
    } else {
      doc.setTextColor(0, 150, 80);
      doc.text('Situação: Em Dia', 155, yr, { align: 'right' });
    }
    doc.setTextColor(0, 0, 0);
    yPos = Math.max(yPos, yr) + 15;

    // ── Bloco de presença condicional ───────────────────────────────────
    if (!comPresenca) {
      rodape();
      const mesAtualSave = new Date().getMonth() + 1;
      const anoAtualSave = new Date().getFullYear();
      const nomeCompletoSave = irmaoData.nome.trim();
      const primNomesSave = nomeCompletoSave.split(' ').slice(0, 2).join('_');
      doc.save(`Rel_Financas_${primNomesSave}_${mesAtualSave}_${anoAtualSave}.pdf`);
      showSuccess('Relatório gerado com sucesso!');
      return;
    }

    // Mensagem da Tesouraria
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0); // Preto
    doc.text('Tesouraria - Acácia de Paranatinga nº 30', 105, yPos, { align: 'center' });
    yPos += 7;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(0, 0, 0); // Preto
    
    // Quebrar o texto em múltiplas linhas
    const mensagem = '"Irmãos, o cumprimento de nossas obrigações financeiras é um ato de honra';
    const mensagem2 = 'e compromisso com a nossa Loja, bem como com os ideais que nos unem."';
    
    doc.text(mensagem, 105, yPos, { align: 'center', maxWidth: 170 });
    yPos += 5;
    doc.text(mensagem2, 105, yPos, { align: 'center', maxWidth: 170 });
    yPos += 15;

    // ========================================
    // PRESENÇA (ÚLTIMAS 5 SESSÕES) - FORMATO MATRIZ
    // ========================================
    if (ultimasSessoes && ultimasSessoes.length > 0) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Presença nas Últimas 5 Sessões:', 15, yPos);
      yPos += 6;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${irmaoData.nome} - CIM: ${irmaoData.cim || 'N/A'}`, 15, yPos);
      yPos += 8;

      // Título do quadro
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Quadro de Situações das 05 Últimas Sessões', 15, yPos);
      yPos += 6;

      // Preparar dados da tabela vertical
      const tableData = [];
      
      ultimasSessoes.forEach(sessao => {
        // Data completa - corrigir timezone
        const dataSessao = new Date(sessao.data_sessao + 'T12:00:00');
        const dataFormatada = dataSessao.toLocaleDateString('pt-BR');
        
        // Determinar grau da sessão - incluindo administrativa
        let grauSessao = sessao.grau_sessao_id || 1;
        const grauOriginal = sessao.grau_sessao_id || 1;
        
        // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
        if (grauSessao === 4) grauSessao = 1;
        
        const grauNome = grauOriginal === 4 ? 'Administrativa' :
                        grauSessao === 3 ? 'Mestre' : 
                        grauSessao === 2 ? 'Companheiro' : 'Aprendiz';
        
        // Calcular grau do irmão na data
        let grauIrmao = 0;
        if (irmaoData.data_exaltacao && dataSessao >= new Date(irmaoData.data_exaltacao + 'T12:00:00')) {
          grauIrmao = 3;
        } else if (irmaoData.data_elevacao && dataSessao >= new Date(irmaoData.data_elevacao + 'T12:00:00')) {
          grauIrmao = 2;
        } else if (irmaoData.data_iniciacao && dataSessao >= new Date(irmaoData.data_iniciacao + 'T12:00:00')) {
          grauIrmao = 1;
        }
        
        // Determinar status - usar letras ao invés de símbolos
        let status = 'N/A';
        if (grauSessao > grauIrmao) {
          status = '-';
        } else {
          const registro = presencas?.find(p => p.sessao_id === sessao.id);
          if (registro) {
            if (registro.presente) {
              status = 'S Presente';
            } else if (registro.justificativa) {
              status = 'J Justificado';
            } else {
              status = 'X Ausente';
            }
          } else {
            status = 'X Ausente';
          }
        }
        
        tableData.push([dataFormatada, grauNome, status]);
      });

      await import('jspdf-autotable');
      
      doc.autoTable({
        startY: yPos,
        head: [['Data', 'Grau', 'Status']],
        body: tableData,
        headStyles: { 
          fillColor: [33, 150, 243],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: { 
          fontSize: 10,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'center' },
          1: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 45, halign: 'left', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        margin: { left: 15, right: 15 }
      });

      yPos = doc.lastAutoTable.finalY + 4;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text('S = Presente | X = Ausente | J = Justificado | - = Não elegível', 15, yPos);
      yPos += 10;

      // ========================================
      // ESTATÍSTICAS DE PRESENÇA
      // ========================================
      
      // Determinar grau do irmão em cada sessão (baseado nas datas)
      const obterGrauNaData = (dataSessao) => {
        const data = new Date(dataSessao + 'T12:00:00');
        let grau = 0;
        if (irmaoData.data_exaltacao && data >= new Date(irmaoData.data_exaltacao + 'T12:00:00')) grau = 3;
        else if (irmaoData.data_elevacao && data >= new Date(irmaoData.data_elevacao + 'T12:00:00')) grau = 2;
        else if (irmaoData.data_iniciacao && data >= new Date(irmaoData.data_iniciacao + 'T12:00:00')) grau = 1;
        
        return grau;
      };

      // Calcular estatísticas das últimas 5 sessões (apenas sessões elegíveis)
      let totalSessoes5 = 0;
      let presencas5 = 0;
      let ausencias5 = 0;
      let justificadas5 = 0;

      ultimasSessoes.forEach(sessao => {
        let grauSessao = sessao.grau_sessao_id || 1;
        
        // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
        if (grauSessao === 4) grauSessao = 1;
        
        const grauIrmao = obterGrauNaData(sessao.data_sessao);
        
        // Só contar se irmão tinha grau suficiente
        if (grauIrmao >= grauSessao) {
          totalSessoes5++;
          const registro = presencas?.find(p => p.sessao_id === sessao.id);
          if (registro) {
            if (registro.presente) {
              presencas5++;
            } else if (registro.justificativa) {
              justificadas5++;
            } else {
              ausencias5++;
            }
          } else {
            // Sem registro = ausência
            ausencias5++;
          }
        }
      });

      const taxa5 = totalSessoes5 > 0 ? ((presencas5 / totalSessoes5) * 100).toFixed(1) : '0.0';

      // Buscar estatísticas anuais com paginação
      const anoAtual = new Date().getFullYear();
      
      let sessoesAno = [];
      let inicio = 0;
      const tamanhoPagina = 1000;
      let continuar = true;

      while (continuar) {
        const { data: lote } = await supabase
          .from('sessoes_presenca')
          .select('id, data_sessao, grau_sessao_id')
          .gte('data_sessao', `${anoAtual}-01-01`)
          .lte('data_sessao', `${anoAtual}-12-31`)
          .lte('data_sessao', new Date().toISOString().split('T')[0]) // Não incluir sessões futuras
          .order('data_sessao', { ascending: true })
          .range(inicio, inicio + tamanhoPagina - 1);

        if (lote && lote.length > 0) {
          sessoesAno = [...sessoesAno, ...lote];
          inicio += tamanhoPagina;
          
          if (lote.length < tamanhoPagina) {
            continuar = false;
          }
        } else {
          continuar = false;
        }
      }

      console.log('📊 Sessões do ano BUSCADAS:', sessoesAno?.length);
      console.log('📅 Primeira sessão:', sessoesAno?.[0]);
      console.log('📅 Última sessão:', sessoesAno?.[sessoesAno.length - 1]);

      const { data: registrosAno } = await supabase
        .from('registros_presenca')
        .select('*')
        .eq('membro_id', irmaoId)
        .in('sessao_id', sessoesAno?.map(s => s.id) || []);

      let totalSessoesAnoGeral = sessoesAno?.length || 0;
      let totalSessoesElegiveis = 0;
      let presencasContadasAno = 0;
      let ausenciasAno = 0;
      let justificadasAno = 0;

      console.log('📊 Total sessões ano:', totalSessoesAnoGeral);
      console.log('👤 Irmão:', irmaoData.nome);
      console.log('📅 Datas grau:', {
        iniciacao: irmaoData.data_iniciacao,
        elevacao: irmaoData.data_elevacao,
        exaltacao: irmaoData.data_exaltacao
      });

      sessoesAno?.forEach(sessao => {
        let grauSessao = sessao.grau_sessao_id || 1;
        
        // Sessão Administrativa (grau 4) deve ser tratada como Aprendiz (grau 1)
        if (grauSessao === 4) grauSessao = 1;
        
        const grauIrmao = obterGrauNaData(sessao.data_sessao);
        
        const elegivel = grauIrmao >= grauSessao;
        
        if (elegivel) {
          console.log('✅ Elegível:', sessao.data_sessao, 'Grau sessão:', grauSessao, 'Grau irmão:', grauIrmao);
        } else {
          console.log('❌ NÃO elegível:', sessao.data_sessao, 'Grau sessão:', grauSessao, 'Grau irmão:', grauIrmao);
        }
        
        // Só contar se irmão tinha grau suficiente
        if (elegivel) {
          totalSessoesElegiveis++;
          const reg = registrosAno?.find(r => r.sessao_id === sessao.id);
          if (reg) {
            if (reg.presente) {
              presencasContadasAno++;
            } else if (reg.justificativa) {
              justificadasAno++;
            } else {
              ausenciasAno++;
            }
          } else {
            // Sem registro = ausência
            ausenciasAno++;
          }
        }
      });

      console.log('🎯 RESULTADO:', {
        totalGeral: totalSessoesAnoGeral,
        elegiveis: totalSessoesElegiveis,
        presencas: presencasContadasAno,
        ausencias: ausenciasAno
      });

      const taxaAno = totalSessoesElegiveis > 0 ? ((presencasContadasAno / totalSessoesElegiveis) * 100).toFixed(1) : '0.0';

      // Desenhar quadro de estatísticas no formato de grade
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Grade de Presença - Últimas 5 Sessões:', 15, yPos);
      yPos += 7;

      // Montar cabeçalho da grade com datas e graus
      const headers = [{ title: 'Grau', dataKey: 'grau' }];
      
      ultimasSessoes.forEach((sessao, index) => {
        const dataSessao = new Date(sessao.data_sessao + 'T12:00:00');
        const dataFormatada = dataSessao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        let grauOriginal = sessao.grau_sessao_id || 1;
        const grauTexto = grauOriginal === 4 ? 'ADM' :
                         grauOriginal === 1 ? 'A' : 
                         grauOriginal === 2 ? 'C' : 'M';
        headers.push({
          title: `${dataFormatada}\n${grauTexto}`,
          dataKey: `sessao_${index}`
        });
      });
      
      headers.push({ title: 'Total', dataKey: 'total' });
      headers.push({ title: '%', dataKey: 'percentual' });

      // Montar linha do irmão
      const row = {
        grau: irmaoData.data_exaltacao ? (irmaoData.mestre_instalado ? 'M.I' : 'M') :
              irmaoData.data_elevacao ? 'C' : 'A'
      };

      let presencasGrade = 0;
      let sessoesElegiveisGrade = 0;

      ultimasSessoes.forEach((sessao, index) => {
        let grauSessao = sessao.grau_sessao_id || 1;
        if (grauSessao === 4) grauSessao = 1;
        
        const grauIrmao = obterGrauNaData(sessao.data_sessao);
        
        if (grauIrmao >= grauSessao) {
          sessoesElegiveisGrade++;
          const registro = presencas?.find(p => p.sessao_id === sessao.id);
          if (registro) {
            if (registro.presente) {
              presencasGrade++;
              row[`sessao_${index}`] = 'P';
            } else if (registro.justificativa) {
              row[`sessao_${index}`] = 'J';
            } else {
              row[`sessao_${index}`] = 'F';
            }
          } else {
            row[`sessao_${index}`] = 'F';
          }
        } else {
          row[`sessao_${index}`] = '-';
        }
      });

      row.total = `${presencasGrade}/${sessoesElegiveisGrade}`;
      row.percentual = sessoesElegiveisGrade > 0 
        ? `${Math.round((presencasGrade / sessoesElegiveisGrade) * 100)}%` 
        : '0%';

      doc.autoTable({
        startY: yPos,
        head: [headers],
        body: [[row.grau, row.sessao_0, row.sessao_1, row.sessao_2, row.sessao_3, row.sessao_4, row.total, row.percentual]],
        headStyles: {
          fillColor: [33, 150, 243],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 2
        },
        bodyStyles: {
          fontSize: 10,
          halign: 'center',
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 15, fontStyle: 'bold' },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 25, fontStyle: 'bold' },
          7: { cellWidth: 20, fontStyle: 'bold' }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index > 0 && data.column.index < 6) {
            const cellValue = data.cell.text[0];
            if (cellValue === 'P') {
              data.cell.styles.textColor = [0, 128, 0];
              data.cell.styles.fontStyle = 'bold';
            } else if (cellValue === 'F') {
              data.cell.styles.textColor = [255, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            } else if (cellValue === 'J') {
              data.cell.styles.textColor = [255, 165, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: 15, right: 15 }
      });
    }

    // Salvar com novo padrão de nome
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    const nomeCompleto = irmaoData.nome.trim();
    const primeirosDoisNomes = nomeCompleto.split(' ').slice(0, 2).join('_');
    
    doc.save(`Rel_Financas_${primeirosDoisNomes}_${mesAtual}_${anoAtual}.pdf`);
    showSuccess('Relatório gerado com sucesso!');

  } catch (error) {
    console.error('Erro:', error);
    showError('Erro ao gerar relatório: ' + error.message);
  }
}

export async function gerarRelatorioDeTodos({ lancamentos, inclPresenca, showSuccess, showError, meses, supabase }) {
  try {
    showSuccess('Gerando relatórios de todos os inadimplentes...');
    
    const lancamentosPendentes = lancamentos.filter(
      l => l.status === 'pendente' && l.origem_tipo === 'Irmao'
    );

    if (lancamentosPendentes.length === 0) {
      showError('Nenhum irmão com pendências financeiras!');
      return;
    }

    // Agrupar por irmão
    const irmaosComPendencias = {};
    lancamentosPendentes.forEach(lanc => {
      const irmaoId = lanc.origem_irmao_id;
      if (!irmaosComPendencias[irmaoId]) {
        irmaosComPendencias[irmaoId] = true;
      }
    });

    const irmaoIds = Object.keys(irmaosComPendencias);
    
    if (irmaoIds.length === 0) {
      showError('Nenhum irmão identificado com pendências!');
      return;
    }

    showSuccess(`Gerando ${irmaoIds.length} relatórios... Por favor, aguarde.`);

    // Gerar PDF para cada irmão
    let sucessos = 0;
    let erros = 0;

    for (const irmaoId of irmaoIds) {
      try {
        await gerarRelatorioIndividual(parseInt(irmaoId), inclPresenca, { meses, supabase, showSuccess, showError });
        sucessos++;
        // Pequeno delay entre PDFs para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Erro ao gerar PDF do irmão ${irmaoId}:`, error);
        erros++;
      }
    }

    if (erros === 0) {
      showSuccess(`✅ ${sucessos} relatórios gerados com sucesso!`);
    } else {
      showError(`⚠️ ${sucessos} relatórios gerados com sucesso. ${erros} com erro.`);
    }

  } catch (error) {
    console.error('Erro geral:', error);
    showError('Erro ao gerar relatórios em lote: ' + error.message);
  }
}
