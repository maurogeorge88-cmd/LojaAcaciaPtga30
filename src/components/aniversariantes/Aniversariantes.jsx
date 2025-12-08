import { useState, useEffect } from 'react';
import { supabase } from '../../App';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Aniversariantes() {
  const [aniversariantes, setAniversariantes] = useState([]);
  const [filtro, setFiltro] = useState('hoje');
  const [loading, setLoading] = useState(true);

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
    doc.text('🎂 Relatório de Aniversariantes', 105, 25, { align: 'center' });
    
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
      // Buscar dados adicionais para irmãos (pais e filhos falecidos)
      const irmaosIds = aniversariantes
        .filter(a => a.tipo === 'Irmão' && a.irmao_id)
        .map(a => a.irmao_id);
      
      let paisFalecidosMap = {};
      let filhosFalecidosMap = {};
      
      if (irmaosIds.length > 0) {
        // Buscar pais falecidos
        const { data: paisFalecidos } = await supabase
          .from('pais')
          .select('irmao_id, nome, data_falecimento')
          .in('irmao_id', irmaosIds)
          .eq('falecido', true);
        
        if (paisFalecidos) {
          paisFalecidos.forEach(pai => {
            if (!paisFalecidosMap[pai.irmao_id]) {
              paisFalecidosMap[pai.irmao_id] = [];
            }
            paisFalecidosMap[pai.irmao_id].push({
              nome: pai.nome,
              data: pai.data_falecimento
            });
          });
        }
        
        // Buscar filhos falecidos
        const { data: filhosFalecidos } = await supabase
          .from('filhos')
          .select('irmao_id, nome, data_falecimento')
          .in('irmao_id', irmaosIds)
          .eq('falecido', true);
        
        if (filhosFalecidos) {
          filhosFalecidos.forEach(filho => {
            if (!filhosFalecidosMap[filho.irmao_id]) {
              filhosFalecidosMap[filho.irmao_id] = [];
            }
            filhosFalecidosMap[filho.irmao_id].push({
              nome: filho.nome,
              data: filho.data_falecimento
            });
          });
        }
      }
      
      // Preparar dados para a tabela
      const tableData = aniversariantes.map(aniv => {
        const ehHoje = aniv.proximo_aniversario.toDateString() === hoje.toDateString();
        const dataNascFormatada = aniv.data_nascimento.toLocaleDateString('pt-BR');
        
        if (aniv.tipo === 'Irmão') {
          // Para IRMÃOS: Nome, Tipo, Idade, Dt Nascimento, Se Pais Falecidos, Filhos Falecidos com Data
          const paisFalecidos = paisFalecidosMap[aniv.irmao_id] || [];
          const filhosFalecidos = filhosFalecidosMap[aniv.irmao_id] || [];
          
          let paisTexto = '';
          if (paisFalecidos.length > 0) {
            paisTexto = paisFalecidos.map(p => 
              `${p.nome}${p.data ? ' (' + new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR') + ')' : ''}`
            ).join(', ');
          }
          
          let filhosTexto = '';
          if (filhosFalecidos.length > 0) {
            filhosTexto = filhosFalecidos.map(f => 
              `${f.nome}${f.data ? ' (' + new Date(f.data + 'T00:00:00').toLocaleDateString('pt-BR') + ')' : ''}`
            ).join(', ');
          }
          
          return [
            aniv.nome,
            aniv.tipo,
            `${aniv.idade} anos`,
            dataNascFormatada,
            paisTexto || '-',
            filhosTexto || '-',
            ehHoje ? '🎉' : ''
          ];
        } else {
          // Para PAIS, FILHOS, ESPOSA: Nome, Tipo, Idade, Dt Nascimento, Nome do Irmão
          return [
            aniv.nome,
            aniv.tipo,
            `${aniv.idade} anos`,
            dataNascFormatada,
            aniv.irmao_responsavel || '-',
            '',
            ehHoje ? '🎉' : ''
          ];
        }
      });
      
      doc.autoTable({
        startY: 48,
        head: [['Nome', 'Tipo', 'Idade', 'Dt Nasc.', 'Pais Falec./Irmão', 'Filhos Falec.', '']],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Nome
          1: { cellWidth: 20, halign: 'center' }, // Tipo
          2: { cellWidth: 18, halign: 'center' }, // Idade
          3: { cellWidth: 22, halign: 'center' }, // Dt Nascimento
          4: { cellWidth: 42, fontSize: 7 }, // Pais Falecidos ou Irmão
          5: { cellWidth: 42, fontSize: 7 }, // Filhos Falecidos
          6: { cellWidth: 10, halign: 'center', fontStyle: 'bold' } // Status
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        didParseCell: function(data) {
          // Destacar linhas de aniversariantes de hoje
          if (data.row.index >= 0 && data.column.index === 6 && data.cell.raw === '🎉') {
            data.row.cells.forEach(cell => {
              cell.styles.fillColor = [255, 243, 205]; // Amarelo claro
              cell.styles.fontStyle = 'bold';
            });
          }
        }
      });
      
      // Rodapé com totalizadores
      const finalY = doc.lastAutoTable.finalY + 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Resumo:', 15, finalY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      const totalIrmaos = aniversariantes.filter(a => a.tipo === 'Irmão').length;
      const totalPais = aniversariantes.filter(a => a.tipo === 'Pai/Mãe').length;
      const totalEsposas = aniversariantes.filter(a => a.tipo === 'Esposa').length;
      const totalFilhos = aniversariantes.filter(a => a.tipo === 'Filho(a)').length;
      const totalHoje = aniversariantes.filter(a => 
        a.proximo_aniversario.toDateString() === hoje.toDateString()
      ).length;
      
      doc.text(`• Total de Aniversariantes: ${aniversariantes.length}`, 15, finalY + 6);
      doc.text(`• Irmãos: ${totalIrmaos}`, 15, finalY + 11);
      doc.text(`• Pais: ${totalPais}`, 15, finalY + 16);
      doc.text(`• Esposas: ${totalEsposas}`, 15, finalY + 21);
      doc.text(`• Filhos: ${totalFilhos}`, 15, finalY + 26);
      if (filtro !== 'hoje') {
        doc.text(`• Aniversariantes de Hoje: ${totalHoje}`, 15, finalY + 31);
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
      const aniversariantesLista = [];

      console.log('🎂 Iniciando busca de aniversariantes...');

      // ===== IRMÃOS (excluir falecidos) =====
      const { data: irmaos } = await supabase
        .from('irmaos')
        .select('id, cim, nome, data_nascimento, cargo, foto_url, status')
        .neq('status', 'Falecido'); // Excluir irmãos falecidos

      console.log('✅ Irmãos:', irmaos?.length);

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
            aniversariantesLista.push({
              tipo: 'Irmão',
              nome: irmao.nome,
              cim: irmao.cim,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              cargo: irmao.cargo,
              foto_url: irmao.foto_url,
              irmao_id: irmao.id
            });
          }
        });
      }

      // IDs dos irmãos vivos (para filtrar familiares)
      const irmaoVivosIds = irmaos?.map(i => i.id) || [];

      // ===== PAIS (apenas de irmãos vivos) =====
      const { data: pais } = await supabase
        .from('pais')
        .select('nome, data_nascimento, falecido, data_falecimento, irmao_id, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds)
        .neq('falecido', true); // Excluir pais falecidos

      console.log('✅ Pais:', pais?.length);

      if (pais) {
        pais.forEach(pai => {
          // Verificar se o irmão responsável ainda está vivo
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
            aniversariantesLista.push({
              tipo: 'Pai/Mãe',
              nome: pai.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: pai.irmaos?.nome
            });
          }
        });
      }

      // ===== ESPOSAS (apenas de irmãos vivos) =====
      const { data: esposas } = await supabase
        .from('esposas')
        .select('nome, data_nascimento, irmao_id, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds);

      console.log('✅ Esposas:', esposas?.length);

      if (esposas) {
        esposas.forEach(esposa => {
          // Verificar se o irmão responsável ainda está vivo
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
            aniversariantesLista.push({
              tipo: 'Esposa',
              nome: esposa.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: esposa.irmaos?.nome
            });
          }
        });
      }

      // ===== FILHOS (apenas de irmãos vivos e filhos vivos) =====
      const { data: filhos } = await supabase
        .from('filhos')
        .select('nome, data_nascimento, falecido, data_falecimento, irmao_id, irmaos(nome, status)')
        .in('irmao_id', irmaoVivosIds)
        .neq('falecido', true); // Excluir filhos falecidos

      console.log('✅ Filhos:', filhos?.length);

      if (filhos) {
        filhos.forEach(filho => {
          // Verificar se o irmão responsável ainda está vivo
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
            aniversariantesLista.push({
              tipo: 'Filho(a)',
              nome: filho.nome,
              proximo_aniversario: proximoAniv,
              data_nascimento: dataNasc,
              idade,
              irmao_responsavel: filho.irmaos?.nome
            });
          }
        });
      }

      // Ordenar e exibir
      aniversariantesLista.sort((a, b) => a.proximo_aniversario - b.proximo_aniversario);
      console.log('🎂 Total final:', aniversariantesLista.length);
      console.log('📋 Lista:', aniversariantesLista);

      setAniversariantes(aniversariantesLista);
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
          <h2 className="text-2xl font-bold text-gray-800">🎂 Aniversariantes</h2>
          
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aniversariantes.map((aniv, index) => {
              const ehHoje = aniv.proximo_aniversario.toDateString() === new Date().toDateString();
              
              return (
                <div 
                  key={index} 
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
                        {aniv.tipo === 'Irmão' ? '👤' : aniv.tipo === 'Esposa' ? '💑' : '👶'}
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
        )}
      </div>
    </div>
  );
}
