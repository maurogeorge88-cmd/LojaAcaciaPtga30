import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '../../../supabaseClient';

const SITUACOES_ATIVAS = ['regular', 'licenciado'];

// Moeda brasileira: R$ 1.050,55
const fmtR = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Nome curto: primeiro nome + segundo nome. Se o segundo "nome" for uma
// preposição (de/da/do/dos/das), pula pra pegar o ÚLTIMO nome no lugar
// (evita "João Da" — vira "João Silva"). Dá mais espaço nas colunas.
const nomeCurto = (nomeCompleto) => {
  if (!nomeCompleto) return '';
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length <= 2) return nomeCompleto;
  const preposicoes = ['de', 'da', 'do', 'dos', 'das'];
  if (preposicoes.includes(partes[1].toLowerCase())) {
    return `${partes[0]} ${partes[partes.length - 1]}`;
  }
  return `${partes[0]} ${partes[1]}`;
};

export default function RelatorioIrmaosPendencias({ resumoIrmaos, tituloFiltro }) {
  const [dadosLoja, setDadosLoja] = useState(null);

  useEffect(() => {
    carregarDadosLoja();
  }, []);

  const carregarDadosLoja = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_loja')
        .select('*')
        .single();

      if (data) {
        setDadosLoja(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados da loja:', error);
    }
  };

  const gerarRelatorioPDF = () => {
    const doc = new jsPDF();

    // Filtrar apenas irmãos com pendências (saldo negativo) e separar em
    // dois grupos: Ativos/Licenciados x Inativos (Ex-Ofício, Desligados,
    // Excluídos, Irregulares, Suspensos etc.)
    const irmaosComPendencias = resumoIrmaos.filter(irmao => irmao.saldo < 0);
    const ativosELicenciados = irmaosComPendencias
      .filter(i => SITUACOES_ATIVAS.includes((i.situacao || '').toLowerCase()))
      .sort((a, b) => a.nomeIrmao.localeCompare(b.nomeIrmao));
    const inativos = irmaosComPendencias
      .filter(i => !SITUACOES_ATIVAS.includes((i.situacao || '').toLowerCase()))
      .sort((a, b) => a.nomeIrmao.localeCompare(b.nomeIrmao));

    const somaGrupo = (grupo) => ({
      despesas: grupo.reduce((s, i) => s + i.totalDespesas, 0),
      receitas: grupo.reduce((s, i) => s + i.totalReceitas, 0),
      saldo: grupo.reduce((s, i) => s + i.saldo, 0),
      saldoVencido: grupo.reduce((s, i) => s + (i.saldoVencido || 0), 0),
      saldoMesAtual: grupo.reduce((s, i) => s + (i.saldoMesAtual || 0), 0),
      saldoFuturo: grupo.reduce((s, i) => s + (i.saldoFuturo || 0), 0),
    });
    const totAtivos = somaGrupo(ativosELicenciados);
    const totInativos = somaGrupo(inativos);
    const totalDespesas = totAtivos.despesas + totInativos.despesas;
    const totalReceitas = totAtivos.receitas + totInativos.receitas;
    const saldoTotal = totAtivos.saldo + totInativos.saldo;

    // Adicionar logo (se existir nos dados da loja)
    if (dadosLoja?.logo_url) {
      try {
        doc.addImage(dadosLoja.logo_url, 'PNG', 15, 10, 20, 20);
      } catch (error) {
        console.log('Logo não carregada');
      }
    }

    // CABEÇALHO
    const nomeLoja = dadosLoja?.nome_loja || 'Acácia de Paranatinga';
    const numeroLoja = dadosLoja?.numero_loja || '30';
    const oriente = dadosLoja?.oriente || 'Paranatinga';
    const estado = dadosLoja?.estado || 'MT';
    const potencia = dadosLoja?.potencia || 'Grande Oriente do Brasil';

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`ARLS ${nomeLoja} nº ${numeroLoja}`, 105, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Oriente de ${oriente} - ${estado}`, 105, 22, { align: 'center' });
    doc.text(potencia, 105, 27, { align: 'center' });

    // Linha separadora
    doc.setLineWidth(0.5);
    doc.line(15, 32, 195, 32);

    // TÍTULO DO RELATÓRIO
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RELATÓRIO DE IRMÃOS COM PENDÊNCIAS FINANCEIRAS', 105, 40, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dataAtual = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Data: ${dataAtual}`, 105, 47, { align: 'center' });

    // Filtro aplicado (Valor Total / Mês Atual / Vencidos / etc.)
    let y = 55;
    if (tituloFiltro) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text(`Filtro: ${tituloFiltro}`, 105, 53, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      y = 61;
    }

    // Mostra "—" pra zero, evita poluir a tabela com "R$ 0,00" em toda linha
    const fmtOuTraço = (v) => (Math.abs(v) < 0.005 ? '—' : fmtR(Math.abs(v)));

    const colunas = ['Nome', 'Vencido', 'Mês Atual', 'Futuro', 'Total'];
    const colStyles = {
      0: { cellWidth: 60 },
      1: { halign: 'right', cellWidth: 30, textColor: [0, 0, 0] },
      2: { halign: 'right', cellWidth: 30, textColor: [0, 0, 0] },
      3: { halign: 'right', cellWidth: 30, textColor: [0, 0, 0] },
      4: { halign: 'right', cellWidth: 30, textColor: [0, 0, 0], fontStyle: 'bold' },
    };

    const rodapePagina = function (data) {
      const pageCount = doc.internal.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`Página ${data.pageNumber} de ${pageCount}`, 105, pageHeight - 10, { align: 'center' });
      doc.text('Este documento é de uso interno da Loja Maçônica', 105, pageHeight - 5, { align: 'center' });
    };

    // Desenha um grupo (título + tabela + linha de subtotal). Retorna o Y
    // final, já depois do subtotal, pra próxima seção continuar dali.
    const desenharGrupo = (titulo, corTitulo, grupo, totais, tituloCurto) => {
      if (grupo.length === 0) return y;

      if (y + 16 > 280) { doc.addPage(); y = 15; }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...corTitulo);
      doc.text(`${titulo} (${grupo.length})`, 15, y);
      doc.setTextColor(0, 0, 0);
      y += 5;

      const tableData = grupo.map(irmao => [
        nomeCurto(irmao.nomeIrmao),
        fmtOuTraço(irmao.saldoVencido),
        fmtOuTraço(irmao.saldoMesAtual),
        fmtOuTraço(irmao.saldoFuturo),
        fmtR(Math.abs(irmao.saldo)),
      ]);

      doc.autoTable({
        startY: y,
        head: [colunas],
        body: tableData,
        headStyles: { fillColor: corTitulo, textColor: 255, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { textColor: 0 },
        columnStyles: colStyles,
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 10 },
        didDrawPage: rodapePagina,
      });

      y = doc.lastAutoTable.finalY + 2;
      if (y + 8 > 280) { doc.addPage(); y = 15; }

      doc.setFillColor(235, 235, 235);
      doc.rect(15, y, 180, 7, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Subtotal ${tituloCurto || titulo}:`, 18, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(fmtOuTraço(totais.saldoVencido), 105, y + 5, { align: 'right' });
      doc.text(fmtOuTraço(totais.saldoMesAtual), 135, y + 5, { align: 'right' });
      doc.text(fmtOuTraço(totais.saldoFuturo), 165, y + 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(fmtR(Math.abs(totais.saldo)), 195, y + 5, { align: 'right' });
      y += 13;
      return y;
    };

    y = desenharGrupo('IRMÃOS ATIVOS E LICENCIADOS', [37, 99, 235], ativosELicenciados, totAtivos, 'Ativos e Licenciados');
    y = desenharGrupo('IRMÃOS INATIVOS (Ex-Ofício, Desligados, Excluídos, Irregulares, etc.)', [234, 88, 12], inativos, totInativos, 'Irmãos Inativos');

    // RESUMO / TOTAL GERAL
    if (y + 40 > 280) { doc.addPage(); y = 15; }
    y += 3;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(15, y, 180, 34);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL', 20, y + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Irmãos com Pendências: ${irmaosComPendencias.length}`, 20, y + 14);
    doc.text(`  • Ativos e Licenciados: ${ativosELicenciados.length}`, 20, y + 19.5);
    doc.text(`  • Inativos: ${inativos.length}`, 20, y + 25);

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Ativos e Licenciados: ${fmtR(Math.abs(totAtivos.saldo))}`, 110, y + 14);
    doc.text(`Total Inativos: ${fmtR(Math.abs(totInativos.saldo))}`, 110, y + 19.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 87, 34);
    doc.text(`TOTAL GERAL EM ABERTO: ${fmtR(Math.abs(saldoTotal))}`, 20, y + 31.5);
    doc.setTextColor(0, 0, 0);

    // OBSERVAÇÕES
    const finalY = y + 34;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', 15, finalY + 10);

    doc.setFont('helvetica', 'normal');
    doc.text('• Vencido / Mês Atual / Futuro: valor pendente conforme a data de vencimento', 15, finalY + 16);
    doc.text('• Total: soma das 3 faixas — valor total que o irmão deve à Loja', 15, finalY + 22);
    doc.text('• Este relatório lista apenas irmãos com pendências financeiras', 15, finalY + 28);

    // Salvar PDF
    const nomeArquivo = `relatorio_irmaos_pendencias_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
  };

  return (
    <button
      onClick={gerarRelatorioPDF}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center gap-2 transition"
      title="Gerar relatório PDF de irmãos com pendências"
    >
      📄 Relatório PDF (Pendências)
    </button>
  );
}
