import React from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function RelatorioIrmaosPendencias({ resumoIrmaos }) {
  
  const gerarRelatorioPDF = () => {
    const doc = new jsPDF();
    
    // Filtrar apenas irmãos com pendências (saldo negativo)
    const irmaosComPendencias = resumoIrmaos
      .filter(irmao => irmao.saldo < 0)
      .sort((a, b) => a.nomeIrmao.localeCompare(b.nomeIrmao));
    
    const totalDespesas = irmaosComPendencias.reduce((sum, i) => sum + i.totalDespesas, 0);
    const totalReceitas = irmaosComPendencias.reduce((sum, i) => sum + i.totalReceitas, 0);
    const saldoTotal = irmaosComPendencias.reduce((sum, i) => sum + i.saldo, 0);
    
    // Adicionar logo (se existir)
    const logoPath = '/icon-192.png';
    try {
      const img = new Image();
      img.src = logoPath;
      doc.addImage(img, 'PNG', 15, 10, 20, 20);
    } catch (error) {
      console.log('Logo não carregado');
    }
    
    // CABEÇALHO
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Oriente de Paranatinga - MT', 105, 22, { align: 'center' });
    doc.text('Grande Oriente do Brasil - GOMT', 105, 27, { align: 'center' });
    
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
    
    // RESUMO GERAL
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL:', 15, 55);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Irmãos com Pendências: ${irmaosComPendencias.length}`, 15, 62);
    doc.text(`Total de Despesas: R$ ${totalDespesas.toFixed(2)}`, 15, 68);
    doc.text(`Total de Receitas: R$ ${totalReceitas.toFixed(2)}`, 15, 74);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 87, 34); // Laranja para pendências
    doc.text(`Saldo Total em Aberto: R$ ${Math.abs(saldoTotal).toFixed(2)}`, 15, 80);
    doc.setTextColor(0, 0, 0); // Volta para preto
    
    // TABELA DE IRMÃOS
    const tableData = irmaosComPendencias.map(irmao => [
      irmao.nomeIrmao,
      `R$ ${Math.abs(irmao.saldo).toFixed(2)}`,
      'Devedor'
    ]);
    
    doc.autoTable({
      startY: 88,
      head: [['Nome', 'Saldo', 'Status']],
      body: tableData,
      headStyles: {
        fillColor: [33, 150, 243], // Azul
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        textColor: 50
      },
      columnStyles: {
        0: { cellWidth: 100 }, // Nome
        1: { halign: 'right', cellWidth: 45, textColor: [255, 87, 34] }, // Saldo (laranja)
        2: { halign: 'center', cellWidth: 43, fillColor: [255, 243, 224], textColor: [230, 81, 0] } // Status
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: 10 },
      didDrawPage: function(data) {
        // Rodapé
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          105,
          pageHeight - 10,
          { align: 'center' }
        );
        
        doc.text(
          'Este documento é de uso interno da Loja Maçônica',
          105,
          pageHeight - 5,
          { align: 'center' }
        );
      }
    });
    
    // OBSERVAÇÕES
    const finalY = doc.lastAutoTable.finalY || 150;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', 15, finalY + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.text('• Saldo: Valor em aberto que o irmão deve à Loja', 15, finalY + 16);
    doc.text('• Status: Situação financeira do irmão perante a Loja', 15, finalY + 22);
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
