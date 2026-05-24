import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Função para retornar emoji adequado por idade e sexo
const obterEmojiPessoa = (idade, sexo, tipo = null) => {
  if (idade <= 2) return '👶';
  if (idade <= 12) return sexo === 'F' ? '👧' : '👦';
  if (idade <= 17) return sexo === 'F' ? '👧' : '👦';
  if (idade <= 59) {
    if (tipo === 'esposa') return '💑';
    return sexo === 'F' ? '👩' : '👨';
  }
  return sexo === 'F' ? '👵' : '👴';
};

export default function Aniversariantes() {
  const [aniversariantes, setAniversariantes] = useState([]);
  const [filtro, setFiltro] = useState('hoje');
  const [loading, setLoading] = useState(true);
  const [modalEventos, setModalEventos] = useState(false);
  const [eventosCustomizados, setEventosCustomizados] = useState([]);
  const [novoEvento, setNovoEvento] = useState({
    nome: '',
    tipo: 'Maçônico',
    descricao: '',
    dia: '',
    mes: ''
  });
  const [eventoEditando, setEventoEditando] = useState(null);
  const [salvandoEvento, setSalvandoEvento] = useState(false);

  useEffect(() => {
    carregarAniversariantes();
  }, [filtro]);

  useEffect(() => {
    if (modalEventos) {
      carregarEventosCustomizados();
    }
  }, [modalEventos]);

  const carregarEventosCustomizados = async () => {
    try {
      const { data, error } = await supabase
        .from('eventos_comemorativos')
        .select('*')
        .order('mes', { ascending: true })
        .order('dia', { ascending: true });
      
      if (error) throw error;
      setEventosCustomizados(data || []);
    } catch (error) {
      console.log('ℹ️ Tabela eventos_comemorativos não existe ainda');
      setEventosCustomizados([]);
    }
  };

  const salvarEvento = async () => {
    if (!novoEvento.nome || !novoEvento.dia || !novoEvento.mes) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    if (novoEvento.dia < 1 || novoEvento.dia > 31) {
      alert('Dia deve estar entre 1 e 31');
      return;
    }

    if (novoEvento.mes < 1 || novoEvento.mes > 12) {
      alert('Mês deve estar entre 1 e 12');
      return;
    }

    setSalvandoEvento(true);
    try {
      const { error } = await supabase
        .from('eventos_comemorativos')
        .insert([{
          nome: novoEvento.nome,
          tipo: novoEvento.tipo,
          descricao: novoEvento.descricao,
          dia: parseInt(novoEvento.dia),
          mes: parseInt(novoEvento.mes)
        }]);

      if (error) throw error;

      alert('Evento cadastrado com sucesso!');
      setNovoEvento({ nome: '', tipo: 'Maçônico', descricao: '', dia: '', mes: '' });
      carregarEventosCustomizados();
      carregarAniversariantes(); // Recarregar para mostrar o novo evento
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      alert('Erro ao salvar evento. Verifique se a tabela eventos_comemorativos existe no Supabase.');
    } finally {
      setSalvandoEvento(false);
    }
  };

  const editarEvento = (evento) => {
    setEventoEditando({
      id: evento.id,
      nome: evento.nome,
      tipo: evento.tipo || 'Maçônico',
      descricao: evento.descricao || '',
      dia: evento.dia.toString(),
      mes: evento.mes.toString()
    });
  };

  const cancelarEdicao = () => {
    setEventoEditando(null);
  };

  const atualizarEvento = async () => {
    if (!eventoEditando.nome || !eventoEditando.dia || !eventoEditando.mes) {
      alert('Preencha todos os campos obrigatórios!');
      return;
    }

    if (eventoEditando.dia < 1 || eventoEditando.dia > 31) {
      alert('Dia deve estar entre 1 e 31');
      return;
    }

    if (eventoEditando.mes < 1 || eventoEditando.mes > 12) {
      alert('Mês deve estar entre 1 e 12');
      return;
    }

    setSalvandoEvento(true);
    try {
      const { error } = await supabase
        .from('eventos_comemorativos')
        .update({
          nome: eventoEditando.nome,
          tipo: eventoEditando.tipo,
          descricao: eventoEditando.descricao,
          dia: parseInt(eventoEditando.dia),
          mes: parseInt(eventoEditando.mes)
        })
        .eq('id', eventoEditando.id);

      if (error) throw error;

      alert('Evento atualizado com sucesso!');
      setEventoEditando(null);
      carregarEventosCustomizados();
      carregarAniversariantes();
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      alert('Erro ao atualizar evento.');
    } finally {
      setSalvandoEvento(false);
    }
  };

  const excluirEvento = async (id) => {
    if (!confirm('Deseja realmente excluir este evento?')) return;

    try {
      const { error } = await supabase
        .from('eventos_comemorativos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Evento excluído com sucesso!');
      carregarEventosCustomizados();
      carregarAniversariantes();
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      alert('Erro ao excluir evento.');
    }
  };

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
          .eq('vivo', false);
        
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
          
          // Montar texto de vínculos
          let textoIrmao = aniv.irmao_responsavel || '-';
          if (aniv.vinculos && aniv.vinculos.length > 1) {
            textoIrmao = aniv.vinculos.map(v => `${v.tipo} do Irmão ${v.irmao}`).join('; ');
          }
          
          return [
            aniv.nome,
            aniv.tipo,
            `${aniv.idade} anos`,
            dataNascFormatada,
            textoIrmao,
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
        .select('id, cim, nome, data_nascimento, cargo, foto_url, situacao')
        .neq('situacao', 'falecido')
        .neq('situacao', 'irregular')
        .neq('situacao', 'desligado')
        .neq('situacao', 'suspenso')
        .neq('situacao', 'excluído')
        .neq('situacao', 'ex-ofício');

      console.log('✅ Irmãos vivos:', irmaos?.length);
      console.log('📋 IDs dos irmãos vivos:', irmaos?.map(i => `${i.nome} (${i.situacao})`).join(', '));

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
        .select('nome, data_nascimento, irmao_id, falecido, tipo, irmaos(nome, situacao)')
        .in('irmao_id', irmaoVivosIds);
      
      // Filtrar apenas os vivos (falecido = false ou null)
      paisVivos = paisVivos?.filter(p => !p.falecido) || [];

      console.log('✅ Pais vivos:', paisVivos?.length);

      if (paisVivos) {
        paisVivos.forEach(pai => {
          // Garantir que o irmão não está falecido
          if (!pai.irmaos || pai.irmaos.situacao === 'falecido') {
            console.log('⚠️ Pai/Mãe de irmão falecido ignorado:', pai.nome, 'do irmão', pai.irmaos?.nome);
            return;
          }
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
            const sexo = pai.tipo === 'mae' ? 'F' : 'M';
            const tipoExibicao = pai.tipo === 'mae' ? 'Mãe' : 'Pai';
            
            aniversariantesFamiliares.push({
              tipo: tipoExibicao,
              nome: pai.nome,
              sexo: sexo,
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
        .select('nome, data_nascimento, irmao_id, irmaos(nome, situacao)')
        .in('irmao_id', irmaoVivosIds);

      console.log('✅ Esposas:', esposas?.length);

      if (esposas) {
        esposas.forEach(esposa => {
          // Garantir que o irmão não está falecido (redundante, mas mantém segurança)
          if (!esposa.irmaos || esposa.irmaos.situacao === 'falecido') {
            console.log('⚠️ Esposa de irmão falecido ignorada:', esposa.nome, 'do irmão', esposa.irmaos?.nome);
            return;
          }
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
              sexo: 'F',
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: esposa.irmaos?.nome,
              nivel: 2
            });
          }
        });
      }

      // FILHOS VIVOS de irmãos vivos (vivo = true ou null)
      let { data: filhosVivos } = await supabase
        .from('filhos')
        .select('nome, data_nascimento, irmao_id, vivo, data_obito, tipo_vinculo, sexo, irmaos(nome, situacao)')
        .in('irmao_id', irmaoVivosIds);
      
      // Filtrar apenas os vivos: vivo deve ser true ou null E sem data_obito
      filhosVivos = filhosVivos?.filter(f => f.vivo !== false && !f.data_obito) || [];

      console.log('✅ Filhos vivos:', filhosVivos?.length);

      if (filhosVivos) {
        filhosVivos.forEach(filho => {
          // Garantir que o irmão não está falecido
          if (!filho.irmaos || filho.irmaos.situacao === 'falecido') {
            console.log('⚠️ Filho de irmão falecido ignorado:', filho.nome, 'do irmão', filho.irmaos?.nome);
            return;
          }
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
            
            // Usar tipo_vinculo do banco, com fallback para lógica antiga
            let tipoExibicao = 'Filho(a)';
            if (filho.tipo_vinculo) {
              // Capitalizar primeira letra
              tipoExibicao = filho.tipo_vinculo.charAt(0).toUpperCase() + filho.tipo_vinculo.slice(1);
            } else if (filho.sexo) {
              tipoExibicao = filho.sexo === 'M' ? 'Filho' : 'Filha';
            }
            
            aniversariantesFamiliares.push({
              tipo: tipoExibicao,
              nome: filho.nome,
              sexo: filho.sexo || 'M',
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
        .select('id, cim, nome, data_nascimento, cargo, foto_url, situacao')
        .eq('situacao', 'falecido');

      if (errorIrmaosFalecidos) {
        console.error('❌ Erro ao buscar irmãos falecidos:', errorIrmaosFalecidos);
        irmaosFalecidos = [];
      }
      
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
        .select('nome, data_nascimento, irmao_id, falecido, tipo, irmaos(nome, situacao)')
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
          if (pai.irmaos?.situacao === 'falecido') return; // Irmão deve estar vivo
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
            const sexo = pai.tipo === 'mae' ? 'F' : 'M';
            const tipoExibicao = pai.tipo === 'mae' ? 'Mãe' : 'Pai';
            
            aniversariantesInMemoriam.push({
              tipo: tipoExibicao,
              nome: pai.nome,
              sexo: sexo,
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
        .select('nome, data_nascimento, irmao_id, vivo, tipo_vinculo, sexo, irmaos(nome, situacao)')
        .in('irmao_id', irmaoVivosIds);

      if (errorFilhosFalecidos) {
        console.error('❌ Erro ao buscar filhos falecidos:', errorFilhosFalecidos);
        filhosFalecidos = [];
      }
      
      // Filtrar apenas os falecidos (vivo = false)
      filhosFalecidos = filhosFalecidos?.filter(f => f.vivo === false) || [];
      
      console.log('✅ Filhos falecidos:', filhosFalecidos?.length);

      if (filhosFalecidos) {
        filhosFalecidos.forEach(filho => {
          if (filho.irmaos?.situacao === 'falecido') return; // Irmão deve estar vivo
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
            
            // Usar tipo_vinculo do banco, com fallback para lógica antiga
            let tipoExibicao = 'Filho(a)';
            if (filho.tipo_vinculo) {
              // Capitalizar primeira letra
              tipoExibicao = filho.tipo_vinculo.charAt(0).toUpperCase() + filho.tipo_vinculo.slice(1);
            } else if (filho.sexo) {
              tipoExibicao = filho.sexo === 'M' ? 'Filho' : 'Filha';
            }
            
            aniversariantesInMemoriam.push({
              tipo: tipoExibicao,
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
      
      // Buscar eventos cadastrados
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
          .select('nome, data_casamento, irmao_id, irmaos(nome, situacao)')
          .in('irmao_id', irmaoVivosIds);
        
        if (esposasCasamento) {
          esposasCasamento.forEach(esposa => {
            if (esposa.irmaos?.situacao === 'falecido') return;
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
      
      // ===== CONSOLIDAR FAMILIARES DUPLICADOS =====
      // Agrupar por nome + data de nascimento para consolidar duplicatas
      const familiaresMap = new Map();
      
      aniversariantesFamiliares.forEach(familiar => {
        // Normalizar nome: remover espaços extras, lowercase, remover acentos
        const nomeNormalizado = familiar.nome
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/\s+/g, ' '); // Remove espaços múltiplos
        
        // Criar chave única: nome normalizado + timestamp da data de nascimento
        const timestamp = familiar.data_nascimento.getTime();
        const chave = `${nomeNormalizado}-${timestamp}`;
        
        if (familiaresMap.has(chave)) {
          // Familiar já existe - adicionar vínculo
          const familiarExistente = familiaresMap.get(chave);
          
          // Criar array de vínculos se não existir
          if (!familiarExistente.vinculos) {
            familiarExistente.vinculos = [{
              tipo: familiarExistente.tipo,
              irmao: familiarExistente.irmao_responsavel
            }];
          }
          
          // Adicionar novo vínculo
          familiarExistente.vinculos.push({
            tipo: familiar.tipo,
            irmao: familiar.irmao_responsavel
          });
          
          // Atualizar tipo para mostrar que tem múltiplos vínculos
          const tipos = familiarExistente.vinculos.map(v => v.tipo);
          familiarExistente.tipo = tipos.join(' / ');
          
        } else {
          // Primeiro registro deste familiar
          familiaresMap.set(chave, familiar);
        }
      });
      
      // Converter Map de volta para array
      const familiaresConsolidados = Array.from(familiaresMap.values());
      
      // Reordenar após consolidação
      familiaresConsolidados.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      aniversariantesEventos.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);

      // Combinar todos em uma lista única mantendo os níveis
      const todosAniversariantes = [
        ...aniversariantesIrmaos,
        ...familiaresConsolidados,
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

  // ── helpers de estilo ──────────────────────────────────────────
  const inputStyle = {
    width: '100%', padding: '0.6rem 0.85rem', fontSize: '0.875rem',
    background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', color: 'var(--color-text)', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--color-text-muted)', marginBottom: '0.3rem',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  // ── cores por nível ────────────────────────────────────────────
  const nivelConfig = {
    1: { cor: 'var(--color-accent)', corHex: '#c9a84c', label: 'Irmãos',                   icone: '👤' },
    2: { cor: '#10b981',             corHex: '#10b981', label: 'Familiares',                icone: '👨‍👩‍👧‍👦' },
    4: { cor: '#8b5cf6',             corHex: '#8b5cf6', label: 'Eventos Maçônicos e Cívicos', icone: '🔷' },
    3: { cor: 'var(--color-text-muted)', corHex: '#888', label: 'In Memoriam',             icone: '🕊️' },
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '16rem' }}>
        <div style={{
          width: '3rem', height: '3rem', borderRadius: '50%',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  const renderCard = (aniv, index, prefixo) => {
    const hoje = new Date();
    const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
    const cfg = nivelConfig[aniv.nivel] || nivelConfig[1];
    const isInMemoriam = aniv.nivel === 3;

    return (
      <div key={`${prefixo}-${index}`} style={{
        background: 'var(--color-surface)',
        border: `1px solid ${ehHoje ? cfg.corHex : 'var(--color-border)'}`,
        borderLeft: `4px solid ${ehHoje ? '#f59e0b' : cfg.corHex}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1rem',
        boxShadow: ehHoje ? `0 0 12px rgba(245,158,11,0.15)` : 'none',
        transition: 'border-color 0.15s',
        opacity: isInMemoriam ? 0.85 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Avatar */}
          {aniv.foto_url ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={aniv.foto_url}
                alt={aniv.nome}
                style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${cfg.corHex}`,
                  filter: isInMemoriam ? 'grayscale(80%)' : 'none',
                }}
              />
              {isInMemoriam && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '0.9rem' }}>🕊️</span>
              )}
            </div>
          ) : (
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
              background: ehHoje ? 'rgba(245,158,11,0.15)' : `rgba(${cfg.corHex === '#10b981' ? '16,185,129' : cfg.corHex === '#8b5cf6' ? '139,92,246' : cfg.corHex === '#c9a84c' ? '201,168,76' : '136,136,136'},0.12)`,
              border: `2px solid ${ehHoje ? '#f59e0b' : cfg.corHex}`,
            }}>
              {isInMemoriam ? '🕊️' : aniv.tipo === 'Bodas' ? '💑' : aniv.nivel === 4 ? (aniv.icone || '📅') : obterEmojiPessoa(aniv.idade, aniv.sexo, aniv.tipo?.toLowerCase())}
            </div>
          )}

          {/* Dados */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.9rem', fontWeight: 700,
                color: isInMemoriam ? 'var(--color-text-muted)' : 'var(--color-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {aniv.nome}
              </span>
              {ehHoje && <span style={{ fontSize: '1.1rem' }}>{isInMemoriam ? '🙏' : '🎉'}</span>}
            </div>

            <div style={{ fontSize: '0.775rem', color: cfg.corHex, fontWeight: 600, marginTop: '0.1rem' }}>
              {aniv.tipo === 'Bodas'
                ? `${aniv.tipo} · ${aniv.idade} anos de união`
                : aniv.nivel === 4
                  ? aniv.tipo
                  : `${aniv.tipo} · ${aniv.idade} anos`}
            </div>

            {aniv.cim && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                CIM: {aniv.cim}
              </div>
            )}

            {aniv.cargo && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-accent)', marginTop: '0.1rem' }}>
                {aniv.cargo}
              </div>
            )}

            {aniv.vinculos && aniv.vinculos.length > 1 ? (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                {aniv.vinculos.map((v, i) => <span key={i}>• {v.tipo} do Ir∴ {v.irmao} </span>)}
              </div>
            ) : aniv.irmao_responsavel && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                Ir∴ {aniv.irmao_responsavel}
              </div>
            )}

            {aniv.descricao && (
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                {aniv.descricao}
              </div>
            )}

            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem', fontWeight: 500 }}>
              📅 {aniv.proximo_aniversario.toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)', padding: '1.5rem', marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.15rem' }}>
              📅 Datas Comemorativas
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {aniversariantes.length} data{aniversariantes.length !== 1 ? 's' : ''} encontrada{aniversariantes.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setModalEventos(true)} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: 'var(--radius-md)',
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)',
              color: '#8b5cf6', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}>
              ⚙️ Gerenciar Eventos
            </button>
            <button onClick={gerarRelatorioPDF} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: 'var(--radius-md)',
              background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)',
              color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}>
              📄 Gerar PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {[
            { id: 'hoje',   label: '📅 Hoje' },
            { id: 'semana', label: '📆 7 Dias' },
            { id: 'mes',    label: '📊 Este Mês' },
            { id: 'todos',  label: '📋 Todos' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setFiltro(id)} style={{
              padding: '0.45rem 1rem', borderRadius: 'var(--radius-md)',
              border: filtro === id ? '1px solid rgba(201,168,76,0.4)' : '1px solid var(--color-border)',
              background: filtro === id ? 'rgba(201,168,76,0.12)' : 'var(--color-surface-2)',
              color: filtro === id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontSize: '0.85rem', fontWeight: filtro === id ? 600 : 500, cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vazio ─────────────────────────────────────────────── */}
      {aniversariantes.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '240px', gap: '0.75rem',
          background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-xl)', padding: '2rem',
        }}>
          <div style={{ fontSize: '2.5rem' }}>🎂</div>
          <p style={{ fontWeight: 600, color: 'var(--color-text)' }}>Nenhuma data encontrada</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Tente outro filtro</p>
        </div>
      )}

      {/* ── Grupos por nível ──────────────────────────────────── */}
      {aniversariantes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {[1, 2, 4, 3].map(nivel => {
            const grupo = aniversariantes.filter(a => a.nivel === nivel);
            if (!grupo.length) return null;
            const cfg = nivelConfig[nivel];
            return (
              <div key={nivel}>
                {/* Título do grupo */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  marginBottom: '0.85rem', paddingBottom: '0.6rem',
                  borderBottom: `1px solid var(--color-border)`,
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{cfg.icone}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: cfg.corHex }}>
                    {cfg.label}
                  </span>
                  <span style={{
                    padding: '0.1rem 0.55rem', borderRadius: '999px', fontSize: '0.75rem',
                    fontWeight: 600, background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
                  }}>
                    {grupo.length}
                  </span>
                </div>

                {/* Grid de cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '0.75rem',
                }}>
                  {grupo.map((aniv, i) => renderCard(aniv, i, `n${nivel}`))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Gerenciar Eventos ───────────────────────────── */}
      {modalEventos && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '1.5rem', overflowY: 'auto',
        }} onClick={e => e.target === e.currentTarget && setModalEventos(false)}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '860px',
            boxShadow: 'var(--shadow-xl)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                ⚙️ Gerenciar Eventos e Datas Especiais
              </h3>
              <button onClick={() => setModalEventos(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', fontSize: '1.5rem', lineHeight: 1,
              }}>×</button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Formulário novo evento */}
              <div style={{
                background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)', padding: '1.25rem',
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' }}>
                  ➕ Cadastrar Novo Evento
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Nome do Evento *</label>
                    <input style={inputStyle} type="text" value={novoEvento.nome}
                      onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})}
                      placeholder="Ex: Aniversário da Loja" />
                  </div>
                  <div>
                    <label style={labelStyle}>Tipo *</label>
                    <select style={inputStyle} value={novoEvento.tipo}
                      onChange={e => setNovoEvento({...novoEvento, tipo: e.target.value})}>
                      <option value="Maçônico">Maçônico</option>
                      <option value="Cívico">Cívico</option>
                      <option value="Loja">Loja</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Dia *</label>
                    <input style={inputStyle} type="number" min="1" max="31" value={novoEvento.dia}
                      onChange={e => setNovoEvento({...novoEvento, dia: e.target.value})} placeholder="1–31" />
                  </div>
                  <div>
                    <label style={labelStyle}>Mês *</label>
                    <select style={inputStyle} value={novoEvento.mes}
                      onChange={e => setNovoEvento({...novoEvento, mes: e.target.value})}>
                      <option value="">Selecione...</option>
                      {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                        <option key={i+1} value={i+1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Descrição</label>
                    <input style={inputStyle} type="text" value={novoEvento.descricao}
                      onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})}
                      placeholder="Descrição opcional" />
                  </div>
                </div>
                <button onClick={salvarEvento} disabled={salvandoEvento} style={{
                  marginTop: '1rem', padding: '0.6rem 1.25rem',
                  borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.875rem',
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                  color: '#10b981', cursor: salvandoEvento ? 'wait' : 'pointer',
                }}>
                  {salvandoEvento ? 'Salvando...' : '💾 Salvar Evento'}
                </button>
              </div>

              {/* Tabela de eventos cadastrados */}
              {eventosCustomizados.length > 0 ? (
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem' }}>
                    📅 Eventos Cadastrados ({eventosCustomizados.length})
                  </h4>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                          {['Evento', 'Data', 'Tipo', 'Ações'].map(h => (
                            <th key={h} style={{ padding: '0.65rem 0.85rem', textAlign: h === 'Evento' ? 'left' : 'center', fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {eventosCustomizados.map((evento, idx) => (
                          <tr key={evento.id} style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'transparent' : 'var(--color-surface-2)' }}>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{evento.nome}</div>
                              {evento.descricao && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{evento.descricao}</div>}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center', fontWeight: 600, color: 'var(--color-text)' }}>{evento.dia}/{evento.mes}</td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                                {evento.tipo || 'Evento'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                <button onClick={() => editarEvento(evento)} style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-accent)', cursor: 'pointer' }}>✏️ Editar</button>
                                <button onClick={() => excluirEvento(evento.id)} style={{ padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-danger)', cursor: 'pointer' }}>🗑️ Excluir</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', color: 'var(--color-text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
                  <p style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>Nenhum evento cadastrado</p>
                  <p style={{ fontSize: '0.85rem' }}>Use o formulário acima para adicionar</p>
                </div>
              )}

              {/* Botão fechar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
                <button onClick={() => setModalEventos(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: 500, background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Editar Evento ───────────────────────────────── */}
      {eventoEditando && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '520px',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1.1rem 1.4rem', borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>✏️ Editar Evento</h3>
              <button onClick={cancelarEdicao} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.5rem', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nome do Evento *</label>
                <input style={inputStyle} type="text" value={eventoEditando.nome}
                  onChange={e => setEventoEditando({...eventoEditando, nome: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select style={inputStyle} value={eventoEditando.tipo}
                  onChange={e => setEventoEditando({...eventoEditando, tipo: e.target.value})}>
                  <option value="Maçônico">Maçônico</option>
                  <option value="Cívico">Cívico</option>
                  <option value="Loja">Loja</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Dia *</label>
                <input style={inputStyle} type="number" min="1" max="31" value={eventoEditando.dia}
                  onChange={e => setEventoEditando({...eventoEditando, dia: e.target.value})} />
              </div>
              <div>
                <label style={labelStyle}>Mês *</label>
                <select style={inputStyle} value={eventoEditando.mes}
                  onChange={e => setEventoEditando({...eventoEditando, mes: e.target.value})}>
                  <option value="">Selecione...</option>
                  {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => (
                    <option key={i+1} value={i+1}>{m}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Descrição</label>
                <input style={inputStyle} type="text" value={eventoEditando.descricao}
                  onChange={e => setEventoEditando({...eventoEditando, descricao: e.target.value})} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button onClick={cancelarEdicao} style={{ padding: '0.6rem 1.1rem', borderRadius: 'var(--radius-md)', fontWeight: 500, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={atualizarEvento} disabled={salvandoEvento} style={{ padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', fontWeight: 600, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--color-accent)', cursor: salvandoEvento ? 'wait' : 'pointer' }}>
                  {salvandoEvento ? 'Salvando...' : '💾 Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
