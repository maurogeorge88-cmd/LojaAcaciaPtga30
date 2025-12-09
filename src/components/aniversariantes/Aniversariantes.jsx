import { useState, useEffect } from 'react';
import { supabase } from '../../App';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Aniversariantes() {
  const [aniversariantes, setAniversariantes] = useState([]);
  const [filtro, setFiltro] = useState('hoje');
  const [loading, setLoading] = useState(true);
  const [modalEventos, setModalEventos] = useState(false);

  // Eventos fixos maçônicos e cívicos (dia/mês)
  const eventosFixos = [
    { nome: 'Dia de São João Batista', dia: 24, mes: 6, tipo: 'Maçônico', descricao: 'Padroeiro da Maçonaria' },
    { nome: 'Dia do Maçom', dia: 20, mes: 8, tipo: 'Maçônico', descricao: 'Dia do Maçom Brasileiro' },
    { nome: 'Aniversário de Paranatinga', dia: 13, mes: 5, tipo: 'Cívico', descricao: 'Fundação da cidade' },
    { nome: 'Dia da Fraternidade Universal', dia: 21, mes: 3, tipo: 'Maçônico', descricao: 'Equinócio de Outono' },
    { nome: 'Dia do Grão-Mestre', dia: 23, mes: 10, tipo: 'Maçônico', descricao: 'Homenagem ao Grão-Mestre' },
  ];

  useEffect(() => {
    carregarAniversariantes();
  }, [filtro]);

  const gerarRelatorioPDF = async () => {
    const doc = new jsPDF();
    const hoje = new Date();
    
    // Cabeçalho
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', 105, 15, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('📅 Relatório de Datas Comemorativas', 105, 25, { align: 'center' });
    
    // Subtítulo baseado no filtro
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    let subtitulo = '';
    switch(filtro) {
      case 'hoje':
        subtitulo = `Aniversariantes de Hoje - ${hoje.toLocaleDateString('pt-BR')}`;
        break;
      case 'semana':
        subtitulo = 'Aniversariantes dos Próximos 7 Dias';
        break;
      case 'mes':
        subtitulo = `Aniversariantes do Mês - ${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`;
        break;
      case 'todos':
        subtitulo = 'Todos os Aniversariantes';
        break;
    }
    doc.text(subtitulo, 105, 32, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${hoje.toLocaleDateString('pt-BR')} às ${hoje.toLocaleTimeString('pt-BR')}`, 105, 38, { align: 'center' });
    
    // Linha separadora
    doc.setDrawColor(200);
    doc.line(15, 42, 195, 42);
    
    if (aniversariantes.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(150);
      doc.text('Nenhum aniversariante encontrado neste período.', 105, 60, { align: 'center' });
    } else {
      let currentY = 48;
      
      // Separar aniversariantes por nível
      const nivel1 = aniversariantes.filter(a => a.nivel === 1);
      const nivel2 = aniversariantes.filter(a => a.nivel === 2);
      const nivel3 = aniversariantes.filter(a => a.nivel === 3);
      
      // Buscar dados adicionais para irmãos do nível 1 (pais e filhos falecidos)
      const irmaosIds = nivel1.filter(a => a.irmao_id).map(a => a.irmao_id);
      
      let paisFalecidosMap = {};
      let filhosFalecidosMap = {};
      
      if (irmaosIds.length > 0) {
        // Buscar pais falecidos
        const { data: paisFalecidos } = await supabase
          .from('pais')
          .select('irmao_id, nome')
          .in('irmao_id', irmaosIds)
          .eq('falecido', true);
        
        if (paisFalecidos) {
          paisFalecidos.forEach(pai => {
            if (!paisFalecidosMap[pai.irmao_id]) {
              paisFalecidosMap[pai.irmao_id] = [];
            }
            paisFalecidosMap[pai.irmao_id].push({
              nome: pai.nome
            });
          });
        }
        
        // Buscar filhos falecidos
        const { data: filhosFalecidos } = await supabase
          .from('filhos')
          .select('irmao_id, nome')
          .in('irmao_id', irmaosIds)
          .eq('falecido', true);
        
        if (filhosFalecidos) {
          filhosFalecidos.forEach(filho => {
            if (!filhosFalecidosMap[filho.irmao_id]) {
              filhosFalecidosMap[filho.irmao_id] = [];
            }
            filhosFalecidosMap[filho.irmao_id].push({
              nome: filho.nome
            });
          });
        }
      }
      
      // ===== NÍVEL 1: IRMÃOS =====
      if (nivel1.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 139);
        doc.text(`1. IRMÃOS (${nivel1.length})`, 15, currentY);
        currentY += 5;
        
        const tableData1 = nivel1.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          const dataNascFormatada = aniv.data_nascimento.toLocaleDateString('pt-BR');
          
          const paisFalecidos = paisFalecidosMap[aniv.irmao_id] || [];
          const filhosFalecidos = filhosFalecidosMap[aniv.irmao_id] || [];
          
          let paisTexto = '';
          if (paisFalecidos.length > 0) {
            paisTexto = paisFalecidos.map(p => p.nome).join(', ');
          }
          
          let filhosTexto = '';
          if (filhosFalecidos.length > 0) {
            filhosTexto = filhosFalecidos.map(f => f.nome).join(', ');
          }
          
          return [
            aniv.nome,
            `${aniv.idade} anos`,
            dataNascFormatada,
            paisTexto || '-',
            filhosTexto || '-',
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Nome', 'Idade', 'Dt Nasc.', 'Pais Falecidos', 'Filhos Falecidos', '']],
          body: tableData1,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [41, 98, 185],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 18, halign: 'center' },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 45, fontSize: 7 },
            4: { cellWidth: 45, fontSize: 7 },
            5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [230, 240, 255]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 5 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // ===== NÍVEL 2: FAMILIARES =====
      if (nivel2.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 128, 0);
        doc.text(`2. FAMILIARES (${nivel2.length})`, 15, currentY);
        currentY += 5;
        
        const tableData2 = nivel2.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          const dataNascFormatada = aniv.data_nascimento.toLocaleDateString('pt-BR');
          
          return [
            aniv.nome,
            aniv.tipo,
            `${aniv.idade} anos`,
            dataNascFormatada,
            aniv.irmao_responsavel || '-',
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Nome', 'Tipo', 'Idade', 'Dt Nasc.', 'Irmão', '']],
          body: tableData2,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [34, 139, 34],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 50 },
            5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [230, 255, 230]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 5 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // ===== NÍVEL 4: EVENTOS MAÇÔNICOS E CÍVICOS =====
      const nivel4 = aniversariantes.filter(a => a.nivel === 4);
      
      if (nivel4.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(128, 0, 128);
        doc.text(`4. EVENTOS MAÇÔNICOS E CÍVICOS (${nivel4.length})`, 15, currentY);
        currentY += 5;
        
        const tableData4 = nivel4.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          
          return [
            aniv.nome,
            aniv.tipo,
            aniv.descricao || '-',
            aniv.proximo_aniversario.toLocaleDateString('pt-BR'),
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Evento', 'Tipo', 'Descrição', 'Data', '']],
          body: tableData4,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [128, 0, 128],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 70, fontSize: 7 },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [245, 230, 255]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 4 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // ===== NÍVEL 3: IN MEMORIAM =====
      if (nivel3.length > 0) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text(`3. IN MEMORIAM (${nivel3.length})`, 15, currentY);
        currentY += 5;
        
        const tableData3 = nivel3.map(aniv => {
          const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
          const dataNascFormatada = aniv.data_nascimento.toLocaleDateString('pt-BR');
          
          return [
            aniv.nome,
            aniv.tipo,
            `${aniv.idade} anos`,
            dataNascFormatada,
            aniv.irmao_responsavel || '-',
            ehHoje ? '🎉' : ''
          ];
        });
        
        doc.autoTable({
          startY: currentY,
          head: [['Nome', 'Tipo', 'Idade', 'Dt Nasc.', 'Irmão', '']],
          body: tableData3,
          styles: {
            fontSize: 8,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [128, 128, 128],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 8
          },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'center' },
            4: { cellWidth: 50 },
            5: { cellWidth: 10, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245]
          },
          didParseCell: function(data) {
            if (data.row.index >= 0 && data.column.index === 5 && data.cell.raw === '🎉') {
              data.row.cells.forEach(cell => {
                cell.styles.fillColor = [255, 243, 205];
                cell.styles.fontStyle = 'bold';
              });
            }
          }
        });
        
        currentY = doc.lastAutoTable.finalY + 10;
      }
      
      // Rodapé com totalizadores
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Resumo:', 15, currentY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const totalIrmaos = nivel1.length;
      const totalFamiliares = nivel2.length;
      const totalEventos = nivel4.length;
      const totalInMemoriam = nivel3.length;
      const totalPais = aniversariantes.filter(a => a.tipo === 'Pai/Mãe').length;
      const totalEsposas = aniversariantes.filter(a => a.tipo === 'Esposa').length;
      const totalBodas = aniversariantes.filter(a => a.tipo === 'Bodas').length;
      const totalFilhos = aniversariantes.filter(a => a.tipo === 'Filho(a)').length;
      const totalHoje = aniversariantes.filter(a => 
        a.proximo_aniversario.toDateString() === hoje.toDateString()
      ).length;
      
      doc.text(`• Total de Datas Comemorativas: ${aniversariantes.length}`, 15, currentY + 6);
      doc.text(`• Irmãos Vivos: ${totalIrmaos}`, 15, currentY + 11);
      doc.text(`• Familiares (Pais: ${totalPais}, Esposas: ${totalEsposas}, Bodas: ${totalBodas}, Filhos: ${totalFilhos})`, 15, currentY + 16);
      doc.text(`• Eventos Maçônicos e Cívicos: ${totalEventos}`, 15, currentY + 21);
      doc.text(`• In Memoriam: ${totalInMemoriam}`, 15, currentY + 26);
      if (filtro !== 'hoje') {
        doc.text(`• Datas de Hoje: ${totalHoje}`, 15, currentY + 31);
      }
    }
    
    // Rodapé da página
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('A∴R∴L∴S∴ Acácia de Paranatinga nº 30', 105, 285, { align: 'center' });
    
    // Salvar
    const nomeArquivo = `Aniversariantes_${filtro}_${hoje.toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
  };

  const carregarAniversariantes = async () => {
    setLoading(true);
    try {
      const hoje = new Date();
      const aniversariantesIrmaos = [];
      const aniversariantesFamiliares = [];
      const aniversariantesInMemoriam = [];

      console.log('🎂 Iniciando busca de aniversariantes...');

      // ===== NÍVEL 1: IRMÃOS VIVOS =====
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, cim, nome, data_nascimento, cargo, foto_url, status')
        .neq('status', 'Falecido');

      console.log('✅ Irmãos vivos:', irmaos?.length);

      if (irmaos) {
        irmaos.forEach(irmao => {
          if (!irmao.data_nascimento) return;

          const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesIrmaos.push({
              tipo: 'Irmão',
              nome: irmao.nome,
              cim: irmao.cim,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              cargo: irmao.cargo,
              foto_url: irmao.foto_url,
              irmao_id: irmao.id,
              nivel: 1
            });
          }
        });
      }

      // IDs dos irmãos vivos (para filtrar familiares)
      const irmaoVivosIds = irmaos?.map(i => i.id) || [];

      // ===== NÍVEL 2: FAMILIARES (Pais, Esposas e Filhos VIVOS de irmãos vivos) =====
      
      // PAIS VIVOS de irmãos vivos (considera null como vivo)
      let { data: paisVivos } = await supabase
        .from('pais')
        .select('nome, data_nascimento, irmao_id, falecido, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds);
      
      // Filtrar apenas os vivos (falecido = false ou null)
      paisVivos = paisVivos?.filter(p => !p.falecido) || [];

      console.log('✅ Pais vivos:', paisVivos?.length);

      if (paisVivos) {
        paisVivos.forEach(pai => {
          if (pai.irmaos?.status === 'Falecido') return;
          if (!pai.data_nascimento) return;

          const dataNasc = new Date(pai.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesFamiliares.push({
              tipo: 'Pai/Mãe',
              nome: pai.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: pai.irmaos?.nome,
              nivel: 2
            });
          }
        });
      }

      // ESPOSAS de irmãos vivos
      const { data: esposas } = await supabase
        .from('esposas')
        .select('nome, data_nascimento, irmao_id, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds);

      console.log('✅ Esposas:', esposas?.length);

      if (esposas) {
        esposas.forEach(esposa => {
          if (esposa.irmaos?.status === 'Falecido') return;
          if (!esposa.data_nascimento) return;

          const dataNasc = new Date(esposa.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesFamiliares.push({
              tipo: 'Esposa',
              nome: esposa.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: esposa.irmaos?.nome,
              nivel: 2
            });
          }
        });
      }

      // FILHOS VIVOS de irmãos vivos (considera null como vivo)
      let { data: filhosVivos } = await supabase
        .from('filhos')
        .select('nome, data_nascimento, irmao_id, falecido, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds);
      
      // Filtrar apenas os vivos (falecido = false ou null)
      filhosVivos = filhosVivos?.filter(f => !f.falecido) || [];

      console.log('✅ Filhos vivos:', filhosVivos?.length);

      if (filhosVivos) {
        filhosVivos.forEach(filho => {
          if (filho.irmaos?.status === 'Falecido') return;
          if (!filho.data_nascimento) return;

          const dataNasc = new Date(filho.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesFamiliares.push({
              tipo: 'Filho(a)',
              nome: filho.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: filho.irmaos?.nome,
              nivel: 2
            });
          }
        });
      }

      // ===== NÍVEL 3: IN MEMORIAM =====
      
      // IRMÃOS FALECIDOS
      let { data: irmaosFalecidos, error: errorIrmaosFalecidos } = await supabase
        .from('irmaos')
        .select('id, cim, nome, data_nascimento, cargo, foto_url, status');

      if (errorIrmaosFalecidos) {
        console.error('❌ Erro ao buscar irmãos falecidos:', errorIrmaosFalecidos);
        irmaosFalecidos = [];
      }
      
      // Filtrar apenas os falecidos (status = 'Falecido')
      irmaosFalecidos = irmaosFalecidos?.filter(i => i.status === 'Falecido') || [];
      
      console.log('✅ Irmãos falecidos:', irmaosFalecidos?.length);

      if (irmaosFalecidos) {
        irmaosFalecidos.forEach(irmao => {
          if (!irmao.data_nascimento) return;

          const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesInMemoriam.push({
              tipo: 'Irmão',
              nome: irmao.nome,
              cim: irmao.cim,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              cargo: irmao.cargo,
              foto_url: irmao.foto_url,
              irmao_id: irmao.id,
              nivel: 3,
              falecido: true
            });
          }
        });
      }

      // PAIS FALECIDOS de irmãos VIVOS
      let { data: paisFalecidos, error: errorPaisFalecidos } = await supabase
        .from('pais')
        .select('nome, data_nascimento, irmao_id, falecido, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds);

      if (errorPaisFalecidos) {
        console.error('❌ Erro ao buscar pais falecidos:', errorPaisFalecidos);
        paisFalecidos = [];
      }
      
      // Filtrar apenas os falecidos (falecido = true)
      paisFalecidos = paisFalecidos?.filter(p => p.falecido === true) || [];
      
      console.log('✅ Pais falecidos:', paisFalecidos?.length);

      if (paisFalecidos) {
        paisFalecidos.forEach(pai => {
          if (pai.irmaos?.status === 'Falecido') return; // Irmão deve estar vivo
          if (!pai.data_nascimento) return;

          const dataNasc = new Date(pai.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesInMemoriam.push({
              tipo: 'Pai/Mãe',
              nome: pai.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: pai.irmaos?.nome,
              nivel: 3,
              falecido: true
            });
          }
        });
      }

      // FILHOS FALECIDOS de irmãos VIVOS
      let { data: filhosFalecidos, error: errorFilhosFalecidos } = await supabase
        .from('filhos')
        .select('nome, data_nascimento, irmao_id, falecido, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds);

      if (errorFilhosFalecidos) {
        console.error('❌ Erro ao buscar filhos falecidos:', errorFilhosFalecidos);
        filhosFalecidos = [];
      }
      
      // Filtrar apenas os falecidos (falecido = true)
      filhosFalecidos = filhosFalecidos?.filter(f => f.falecido === true) || [];
      
      console.log('✅ Filhos falecidos:', filhosFalecidos?.length);

      if (filhosFalecidos) {
        filhosFalecidos.forEach(filho => {
          if (filho.irmaos?.status === 'Falecido') return; // Irmão deve estar vivo
          if (!filho.data_nascimento) return;

          const dataNasc = new Date(filho.data_nascimento + 'T00:00:00');
          const proximoAniv = new Date(hoje.getFullYear(), dataNasc.getMonth(), dataNasc.getDate());
          
          const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
          if (proximoAniv < hojeZerado) {
            proximoAniv.setFullYear(hoje.getFullYear() + 1);
          }

          const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                        proximoAniv.getMonth() === hoje.getMonth() &&
                        proximoAniv.getFullYear() === hoje.getFullYear();

          const deveMostrar = filtro === 'todos' || 
            (filtro === 'hoje' && ehHoje) ||
            (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
            (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

          if (deveMostrar) {
            const idade = hoje.getFullYear() - dataNasc.getFullYear();
            aniversariantesInMemoriam.push({
              tipo: 'Filho(a)',
              nome: filho.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: filho.irmaos?.nome,
              nivel: 3,
              falecido: true
            });
          }
        });
      }

      // Ordenar cada nível por data de aniversário
      aniversariantesIrmaos.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      aniversariantesFamiliares.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      aniversariantesInMemoriam.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);

      // ===== NÍVEL 4: EVENTOS MAÇÔNICOS E CÍVICOS =====
      const aniversariantesEventos = [];
      
      // Processar eventos fixos
      eventosFixos.forEach(evento => {
        const proximoEvento = new Date(hoje.getFullYear(), evento.mes - 1, evento.dia);
        
        const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        if (proximoEvento < hojeZerado) {
          proximoEvento.setFullYear(hoje.getFullYear() + 1);
        }

        const ehHoje = proximoEvento.getDate() === hoje.getDate() && 
                      proximoEvento.getMonth() === hoje.getMonth() &&
                      proximoEvento.getFullYear() === hoje.getFullYear();

        const deveMostrar = filtro === 'todos' || 
          (filtro === 'hoje' && ehHoje) ||
          (filtro === 'semana' && proximoEvento <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
          (filtro === 'mes' && proximoEvento.getMonth() === hoje.getMonth());

        if (deveMostrar) {
          aniversariantesEventos.push({
            tipo: evento.tipo,
            nome: evento.nome,
            descricao: evento.descricao,
            proximo_aniversario: proximoEvento,
            nivel: 4,
            icone: evento.tipo === 'Maçônico' ? '🔷' : '🏛️'
          });
        }
      });
      
      // Buscar eventos cadastrados (futura implementação)
      try {
        const { data: eventosCustomizados } = await supabase
          .from('eventos_comemorativos')
          .select('*');
        
        if (eventosCustomizados && eventosCustomizados.length > 0) {
          eventosCustomizados.forEach(evento => {
            if (!evento.dia || !evento.mes) return;
            
            const proximoEvento = new Date(hoje.getFullYear(), evento.mes - 1, evento.dia);
            
            const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            if (proximoEvento < hojeZerado) {
              proximoEvento.setFullYear(hoje.getFullYear() + 1);
            }

            const ehHoje = proximoEvento.getDate() === hoje.getDate() && 
                          proximoEvento.getMonth() === hoje.getMonth() &&
                          proximoEvento.getFullYear() === hoje.getFullYear();

            const deveMostrar = filtro === 'todos' || 
              (filtro === 'hoje' && ehHoje) ||
              (filtro === 'semana' && proximoEvento <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
              (filtro === 'mes' && proximoEvento.getMonth() === hoje.getMonth());

            if (deveMostrar) {
              aniversariantesEventos.push({
                tipo: evento.tipo || 'Evento',
                nome: evento.nome,
                descricao: evento.descricao,
                proximo_aniversario: proximoEvento,
                nivel: 4,
                icone: '📅'
              });
            }
          });
        }
      } catch (error) {
        // Tabela ainda não existe, ignorar
        console.log('ℹ️ Tabela eventos_comemorativos não encontrada (será criada futuramente)');
      }
      
      // Buscar ANIVERSÁRIOS DE CASAMENTO das esposas (se o campo existir)
      try {
        const { data: esposasCasamento } = await supabase
          .from('esposas')
          .select('nome, data_casamento, irmao_id, irmaos(nome, status)')
          .in('irmao_id', irmaoVivosIds);
        
        if (esposasCasamento) {
          esposasCasamento.forEach(esposa => {
            if (esposa.irmaos?.status === 'Falecido') return;
            if (!esposa.data_casamento) return;

            const dataCas = new Date(esposa.data_casamento + 'T00:00:00');
            const proximoAniv = new Date(hoje.getFullYear(), dataCas.getMonth(), dataCas.getDate());
            
            const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            if (proximoAniv < hojeZerado) {
              proximoAniv.setFullYear(hoje.getFullYear() + 1);
            }

            const ehHoje = proximoAniv.getDate() === hoje.getDate() && 
                          proximoAniv.getMonth() === hoje.getMonth() &&
                          proximoAniv.getFullYear() === hoje.getFullYear();

            const deveMostrar = filtro === 'todos' || 
              (filtro === 'hoje' && ehHoje) ||
              (filtro === 'semana' && proximoAniv <= new Date(hoje.getTime() + 7*24*60*60*1000)) ||
              (filtro === 'mes' && proximoAniv.getMonth() === hoje.getMonth());

            if (deveMostrar) {
              const anosDeUniao = hoje.getFullYear() - dataCas.getFullYear();
              aniversariantesFamiliares.push({
                tipo: 'Bodas',
                nome: `${esposa.irmaos?.nome} & ${esposa.nome}`,
                proximo_aniversario: proximoAniv,
                data_nascimento: dataCas,
                idade: anosDeUniao,
                irmao_responsavel: esposa.irmaos?.nome,
                nivel: 2,
                icone: '💑'
              });
            }
          });
        }
      } catch (error) {
        // Campo data_casamento ainda não existe na tabela esposas
        console.log('ℹ️ Campo data_casamento não encontrado (adicione na tabela esposas futuramente)');
      }
      
      // Reordenar familiares após adicionar bodas
      aniversariantesFamiliares.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      aniversariantesEventos.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);

      // Combinar todos em uma lista única mantendo os níveis
      const todosAniversariantes = [
        ...aniversariantesIrmaos,
        ...aniversariantesFamiliares,
        ...aniversariantesEventos,
        ...aniversariantesInMemoriam
      ];

      console.log('🎂 Total Irmãos:', aniversariantesIrmaos.length);
      console.log('🎂 Total Familiares:', aniversariantesFamiliares.length);
      console.log('🎂 Total Eventos:', aniversariantesEventos.length);
      console.log('🎂 Total In Memoriam:', aniversariantesInMemoriam.length);
      console.log('🎂 Total Final:', todosAniversariantes.length);

      setAniversariantes(todosAniversariantes);
      setLoading(false);
    } catch (error) {
      console.error('❌ ERRO:', error);
      setAniversariantes([]);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">📅 Datas Comemorativas</h2>
          
          <div className="flex gap-2">
            {/* Botão de Gerenciar Eventos */}
            <button
              onClick={() => setModalEventos(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition flex items-center gap-2"
            >
              <span>⚙️</span>
              <span>Gerenciar Eventos</span>
            </button>
            
            {/* Botão de Gerar Relatório */}
            <button
              onClick={gerarRelatorioPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition flex items-center gap-2"
              disabled={loading}
            >
              <span>📄</span>
              <span>Gerar Relatório PDF</span>
            </button>
          </div>
        </div>
        
        {/* Informações sobre configurações */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
          <p className="text-sm text-blue-800">
            💡 <strong>Configurações pendentes:</strong>
          </p>
          <ul className="text-xs text-blue-700 mt-2 ml-4 list-disc">
            <li>Adicione o campo <code className="bg-blue-100 px-1 rounded">data_casamento</code> na tabela <strong>esposas</strong> para registrar aniversários de casamento</li>
            <li>Crie a tabela <code className="bg-blue-100 px-1 rounded">eventos_comemorativos</code> para cadastrar eventos personalizados</li>
          </ul>
        </div>
        
        {/* Botões de filtro */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button 
            onClick={() => setFiltro('hoje')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtro === 'hoje' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📅 Hoje
          </button>
          <button 
            onClick={() => setFiltro('semana')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtro === 'semana' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📆 Próximos 7 Dias
          </button>
          <button 
            onClick={() => setFiltro('mes')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtro === 'mes' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 Este Mês
          </button>
          <button 
            onClick={() => setFiltro('todos')} 
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filtro === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📋 Todos
          </button>
        </div>

        {/* Lista de aniversariantes */}
        {aniversariantes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎂</div>
            <p className="text-gray-600 text-lg font-medium">Nenhum aniversariante encontrado</p>
            <p className="text-gray-500 text-sm mt-2">Tente outro filtro</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* NÍVEL 1: IRMÃOS */}
            {aniversariantes.filter(a => a.nivel === 1).length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-blue-700 mb-4 flex items-center gap-2">
                  <span className="text-2xl">👤</span>
                  <span>Irmãos ({aniversariantes.filter(a => a.nivel === 1).length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aniversariantes.filter(a => a.nivel === 1).map((aniv, index) => {
                    const ehHoje = aniv.proximo_aniversario.toDateString() === new Date().toDateString();
                    
                    return (
                      <div 
                        key={`nivel1-${index}`} 
                        className={`rounded-lg p-4 border-l-4 ${
                          ehHoje 
                            ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-400' 
                            : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {aniv.foto_url ? (
                            <img 
                              src={aniv.foto_url} 
                              alt={aniv.nome} 
                              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                            />
                          ) : (
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-white shadow ${
                              ehHoje ? 'bg-yellow-200' : 'bg-blue-200'
                            }`}>
                              👤
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-gray-900">{aniv.nome}</h3>
                              {ehHoje && <span className="text-2xl animate-bounce">🎉</span>}
                            </div>
                            
                            <p className="text-sm text-gray-600 font-medium">{aniv.tipo} - {aniv.idade} anos</p>
                            
                            {aniv.cim && (
                              <p className="text-xs text-gray-500">🔹 CIM: {aniv.cim}</p>
                            )}
                            
                            {aniv.cargo && (
                              <p className="text-xs text-blue-600 font-medium">👔 {aniv.cargo}</p>
                            )}
                            
                            <p className="text-xs text-gray-600 mt-1 font-medium">
                              📅 {aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NÍVEL 2: FAMILIARES */}
            {aniversariantes.filter(a => a.nivel === 2).length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
                  <span className="text-2xl">👨‍👩‍👧‍👦</span>
                  <span>Familiares ({aniversariantes.filter(a => a.nivel === 2).length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aniversariantes.filter(a => a.nivel === 2).map((aniv, index) => {
                    const ehHoje = aniv.proximo_aniversario.toDateString() === new Date().toDateString();
                    
                    return (
                      <div 
                        key={`nivel2-${index}`} 
                        className={`rounded-lg p-4 border-l-4 ${
                          ehHoje 
                            ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-400' 
                            : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-white shadow ${
                            ehHoje ? 'bg-yellow-200' : 'bg-green-200'
                          }`}>
                            {aniv.tipo === 'Bodas' ? '💑' : aniv.tipo === 'Esposa' ? '💑' : aniv.tipo === 'Filho(a)' ? '👶' : '👴'}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-gray-900">{aniv.nome}</h3>
                              {ehHoje && <span className="text-2xl animate-bounce">🎉</span>}
                            </div>
                            
                            <p className="text-sm text-gray-600 font-medium">
                              {aniv.tipo === 'Bodas' ? `${aniv.tipo} - ${aniv.idade} anos de união` : `${aniv.tipo} - ${aniv.idade} anos`}
                            </p>
                            
                            {aniv.irmao_responsavel && (
                              <p className="text-xs text-gray-500">👤 Irmão: {aniv.irmao_responsavel}</p>
                            )}
                            
                            <p className="text-xs text-gray-600 mt-1 font-medium">
                              📅 {aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NÍVEL 4: EVENTOS MAÇÔNICOS E CÍVICOS */}
            {aniversariantes.filter(a => a.nivel === 4).length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-purple-700 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔷</span>
                  <span>Eventos Maçônicos e Cívicos ({aniversariantes.filter(a => a.nivel === 4).length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aniversariantes.filter(a => a.nivel === 4).map((aniv, index) => {
                    const ehHoje = aniv.proximo_aniversario.toDateString() === new Date().toDateString();
                    
                    return (
                      <div 
                        key={`nivel4-${index}`} 
                        className={`rounded-lg p-4 border-l-4 ${
                          ehHoje 
                            ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-400' 
                            : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-white shadow ${
                            ehHoje ? 'bg-yellow-200' : 'bg-purple-200'
                          }`}>
                            {aniv.icone || '📅'}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-gray-900">{aniv.nome}</h3>
                              {ehHoje && <span className="text-2xl animate-bounce">🎉</span>}
                            </div>
                            
                            <p className="text-sm text-purple-700 font-medium">{aniv.tipo}</p>
                            
                            {aniv.descricao && (
                              <p className="text-xs text-gray-600 mt-1">{aniv.descricao}</p>
                            )}
                            
                            <p className="text-xs text-gray-600 mt-1 font-medium">
                              📅 {aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* NÍVEL 3: IN MEMORIAM */}
            {aniversariantes.filter(a => a.nivel === 3).length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-600 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🕊️</span>
                  <span>In Memoriam ({aniversariantes.filter(a => a.nivel === 3).length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {aniversariantes.filter(a => a.nivel === 3).map((aniv, index) => {
                    const ehHoje = aniv.proximo_aniversario.toDateString() === new Date().toDateString();
                    
                    return (
                      <div 
                        key={`nivel3-${index}`} 
                        className={`rounded-lg p-4 border-l-4 ${
                          ehHoje 
                            ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-400' 
                            : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {aniv.foto_url ? (
                            <div className="relative">
                              <img 
                                src={aniv.foto_url} 
                                alt={aniv.nome} 
                                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow grayscale"
                              />
                              <span className="absolute -top-1 -right-1 text-lg">🕊️</span>
                            </div>
                          ) : (
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl border-2 border-white shadow ${
                              ehHoje ? 'bg-yellow-200' : 'bg-gray-200'
                            }`}>
                              🕊️
                            </div>
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-gray-700">{aniv.nome}</h3>
                              {ehHoje && <span className="text-2xl animate-bounce">🎉</span>}
                            </div>
                            
                            <p className="text-sm text-gray-600 font-medium">{aniv.tipo} - {aniv.idade} anos</p>
                            
                            {aniv.cim && (
                              <p className="text-xs text-gray-500">🔹 CIM: {aniv.cim}</p>
                            )}
                            
                            {aniv.irmao_responsavel && (
                              <p className="text-xs text-gray-500">👤 Irmão: {aniv.irmao_responsavel}</p>
                            )}
                            
                            <p className="text-xs text-gray-600 mt-1 font-medium">
                              📅 {aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Modal de Gerenciar Eventos */}
      {modalEventos && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-purple-600 text-white p-6 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">⚙️ Gerenciar Eventos</h3>
                <button
                  onClick={() => setModalEventos(false)}
                  className="text-white hover:text-gray-200 text-3xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Eventos Fixos */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-800 mb-3">🔷 Eventos Fixos (pré-cadastrados)</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="p-2 text-left">Evento</th>
                        <th className="p-2 text-center">Data</th>
                        <th className="p-2 text-center">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventosFixos.map((evento, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">{evento.nome}</td>
                          <td className="p-2 text-center">{evento.dia}/{evento.mes}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs ${
                              evento.tipo === 'Maçônico' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {evento.tipo}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Instruções para criar tabela */}
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
                <h4 className="text-lg font-bold text-yellow-800 mb-2">📋 Como adicionar eventos personalizados:</h4>
                <p className="text-sm text-yellow-700 mb-3">
                  Para cadastrar eventos personalizados, crie a tabela no Supabase:
                </p>
                <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`CREATE TABLE eventos_comemorativos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT,
  descricao TEXT,
  dia INTEGER NOT NULL CHECK (dia >= 1 AND dia <= 31),
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  created_at TIMESTAMP DEFAULT NOW()
);`}
                </pre>
              </div>
              
              {/* Instruções para data de casamento */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <h4 className="text-lg font-bold text-blue-800 mb-2">💑 Como adicionar aniversários de casamento:</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Para registrar aniversários de casamento, adicione o campo na tabela esposas:
                </p>
                <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`ALTER TABLE esposas 
ADD COLUMN data_casamento DATE;`}
                </pre>
                <p className="text-xs text-blue-600 mt-2">
                  Depois, edite cada esposa e adicione a data de casamento no formato DD/MM/AAAA
                </p>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setModalEventos(false)}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
