import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '../../../supabaseClient';

export default function RelatorioIrmaosPendencias({ resumoIrmaos }) {
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
  
  const gerarRelatorioPDF = async () => {
    const doc = new jsPDF();
    
    // Filtrar apenas irmãos com pendências (saldo negativo)
    const irmaosComPendencias = resumoIrmaos
      .filter(irmao => irmao.saldo < 0)
      .sort((a, b) => a.nomeIrmao.localeCompare(b.nomeIrmao));
    
    // BUSCAR PRESENÇAS DAS ÚLTIMAS 5 SESSÕES PARA CADA IRMÃO
    const { data: ultimasSessoes } = await supabase
      .from('sessoes_presenca')
      .select('id, data_sessao, graus_sessao:grau_sessao_id(nome)')
      .order('data_sessao', { ascending: false })
      .limit(5);

    const idsIrmaos = irmaosComPendencias.map(i => i.irmaoId);
    const { data: presencas } = await supabase
      .from('registros_presenca')
      .select('*')
      .in('membro_id', idsIrmaos)
      .in('sessao_id', ultimasSessoes?.map(s => s.id) || []);
    
    const totalDespesas = irmaosComPendencias.reduce((sum, i) => sum + i.totalDespesas, 0);
    const totalReceitas = irmaosComPendencias.reduce((sum, i) => sum + i.totalReceitas, 0);
    const saldoTotal = irmaosComPendencias.reduce((sum, i) => sum + i.saldo, 0);
    
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
    
    // TABELA DE PRESENÇAS (ÚLTIMAS 5 SESSÕES)
    const finalY = doc.lastAutoTable.finalY || 150;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESENÇA NAS ÚLTIMAS 5 SESSÕES:', 15, finalY + 10);
    
    if (ultimasSessoes && ultimasSessoes.length > 0) {
      const presencaData = irmaosComPendencias.map(irmao => {
        const row = [irmao.nomeIrmao];
        
        ultimasSessoes.forEach(sessao => {
          const registro = presencas?.find(p => 
            p.membro_id === irmao.irmaoId && p.sessao_id === sessao.id
          );
          
          if (registro) {
            if (registro.presente) {
              row.push('✓');
            } else if (registro.justificativa) {
              row.push('J');
            } else {
              row.push('✗');
            }
          } else {
            row.push('-');
          }
        });
        
        return row;
      });
      
      const headers = ['Irmão'];
      ultimasSessoes.forEach(s => {
        const data = new Date(s.data_sessao).toLocaleDateString('pt-BR');
        headers.push(data);
      });
      
      doc.autoTable({
        startY: finalY + 15,
        head: [headers],
        body: presencaData,
        headStyles: {
          fillColor: [76, 175, 80],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8
        },
        bodyStyles: {
          halign: 'center',
          fontSize: 9
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 80 }
        }
      });
      
      const presencaFinalY = doc.lastAutoTable.finalY || finalY + 50;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text('Legenda: ✓ = Presente | ✗ = Ausente | J = Justificado | - = Sem registro', 15, presencaFinalY + 5);
    }
    
    // OBSERVAÇÕES
    const observacoesY = doc.lastAutoTable.finalY || 150;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES:', 15, observacoesY + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.text('• Saldo: Valor em aberto que o irmão deve à Loja', 15, observacoesY + 16);
    doc.text('• Status: Situação financeira do irmão perante a Loja', 15, observacoesY + 22);
    doc.text('• Este relatório lista apenas irmãos com pendências financeiras', 15, observacoesY + 28);
    
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
