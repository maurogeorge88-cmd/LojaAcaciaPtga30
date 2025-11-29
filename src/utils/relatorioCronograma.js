import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const gerarRelatorioCronograma = (eventos, periodo, filtros = {}) => {
  const doc = new jsPDF();
  
  // Configurações
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Header
  doc.setFillColor(79, 70, 229); // Indigo
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text(`Cronograma ${periodo}`, pageWidth / 2, 25, { align: 'center' });

  // Informações do relatório
  yPos = 45;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, yPos);
  doc.text(`Total de eventos: ${eventos.length}`, pageWidth - 60, yPos);
  
  yPos += 10;

  // Agrupar eventos por mês
  const eventosPorMes = {};
  eventos.forEach(evento => {
    const mes = evento.data_evento.substring(0, 7);
    if (!eventosPorMes[mes]) eventosPorMes[mes] = [];
    eventosPorMes[mes].push(evento);
  });

  // Processar cada mês
  Object.entries(eventosPorMes).sort().forEach(([mes, eventosDoMes]) => {
    // Verificar espaço na página
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    // Header do mês
    const [ano, mesNum] = mes.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesNome = `${meses[parseInt(mesNum) - 1]} ${ano}`;

    doc.setFillColor(99, 102, 241); // Indigo claro
    doc.rect(14, yPos, pageWidth - 28, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(mesNome.toUpperCase(), 16, yPos + 7);
    doc.setTextColor(0, 0, 0);
    
    yPos += 15;

    // Tabela de eventos do mês
    const dadosTabela = eventosDoMes.map(evento => {
      const data = evento.data_evento.split('-').reverse().join('/');
      const hora = evento.hora_inicio ? evento.hora_inicio.substring(0, 5) : '-';
      const tipo = obterLabelTipo(evento.tipo);
      const status = obterLabelStatus(evento.status);
      
      return [
        data,
        hora,
        tipo,
        evento.titulo,
        evento.local || '-',
        status
      ];
    });

    doc.autoTable({
      startY: yPos,
      head: [['Data', 'Hora', 'Tipo', 'Evento', 'Local', 'Status']],
      body: dadosTabela,
      theme: 'striped',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 22 },  // Data
        1: { cellWidth: 18 },  // Hora
        2: { cellWidth: 30 },  // Tipo
        3: { cellWidth: 60 },  // Evento
        4: { cellWidth: 35 },  // Local
        5: { cellWidth: 25 }   // Status
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    });

    yPos = doc.lastAutoTable.finalY + 10;
  });

  // Rodapé final
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : yPos;
  if (finalY < pageHeight - 40) {
    doc.setDrawColor(200, 200, 200);
    doc.line(14, finalY + 15, pageWidth - 14, finalY + 15);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('T∴F∴A∴', pageWidth / 2, finalY + 22, { align: 'center' });
  }

  // Salvar PDF
  const nomeArquivo = `Cronograma_${periodo.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
};

// Funções auxiliares
const obterLabelTipo = (tipo) => {
  const tipos = {
    'sessao': 'Sessão',
    'trabalho_irmao': 'Trabalho',
    'instrucao': 'Instrução',
    'sessao_magna': 'Sessão Magna',
    'evento_externo': 'Evento Externo',
    'outro': 'Outro'
  };
  return tipos[tipo] || tipo;
};

const obterLabelStatus = (status) => {
  const statuses = {
    'planejado': 'Planejado',
    'confirmado': 'Confirmado',
    'realizado': 'Realizado',
    'cancelado': 'Cancelado'
  };
  return statuses[status] || status;
};

// Função para gerar relatório mensal
export const gerarRelatorioMensal = (eventos, mes, ano) => {
  const eventosMes = eventos.filter(e => 
    e.data_evento.startsWith(`${ano}-${mes.toString().padStart(2, '0')}`)
  );
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const periodo = `${meses[mes - 1]} ${ano}`;
  gerarRelatorioCronograma(eventosMes, periodo);
};

// Função para gerar relatório semestral
export const gerarRelatorioSemestral = (eventos, semestre, ano) => {
  const mesesSemestre = semestre === 1 
    ? ['01', '02', '03', '04', '05', '06']
    : ['07', '08', '09', '10', '11', '12'];
  
  const eventosSemestre = eventos.filter(e => {
    const mes = e.data_evento.substring(5, 7);
    return e.data_evento.startsWith(ano.toString()) && mesesSemestre.includes(mes);
  });
  
  const periodo = `${semestre}º Semestre ${ano}`;
  gerarRelatorioCronograma(eventosSemestre, periodo);
};

// Função para gerar relatório anual
export const gerarRelatorioAnual = (eventos, ano) => {
  const eventosAno = eventos.filter(e => 
    e.data_evento.startsWith(ano.toString())
  );
  const periodo = `Anual ${ano}`;
  gerarRelatorioCronograma(eventosAno, periodo);
};
