import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import CalendarioAnual from './CalendarioAnual';

// Funções de geração de PDF (inline para evitar problemas de import)
const gerarRelatorioCronograma = async (eventos, periodo, logoBase64 = null) => {
  // Importar jsPDF dinamicamente
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  
  // PDF em PAISAGEM (landscape)
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header com fundo azul
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Logo (se fornecida)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 10, 7, 22, 22);
    } catch (e) {
      console.log('Erro ao adicionar logo');
    }
  }
  
  // Título principal - linha 1
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ARLS Acacia de Paranatinga No 30', pageWidth / 2, 12, { align: 'center' });
  
  // Título secundário - linha 2
  doc.setFontSize(15);
  doc.text(`Cronograma ${periodo}`, pageWidth / 2, 22, { align: 'center' });
  
  // Linha separadora
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Mato Grosso - Brasil', pageWidth / 2, 30, { align: 'center' });

  // Info do relatório
  let yPos = 42;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Emissao: ${new Date().toLocaleDateString('pt-BR')}`, 14, yPos);
  doc.text(`Total de eventos: ${eventos.length}`, pageWidth - 50, yPos);
  
  yPos += 5;

  // Se não tiver eventos
  if (eventos.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Nenhum evento cadastrado para este periodo', pageWidth / 2, yPos + 30, { align: 'center' });
    const nomeArquivo = `Cronograma_${periodo.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
    return;
  }

  // Agrupar por mês
  const eventosPorMes = {};
  eventos.forEach(evento => {
    const mes = evento.data_evento.substring(0, 7);
    if (!eventosPorMes[mes]) eventosPorMes[mes] = [];
    eventosPorMes[mes].push(evento);
  });

  // Processar cada mês
  Object.entries(eventosPorMes).sort().forEach(([mes, eventosDoMes]) => {
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 15;
    }

    const [ano, mesNum] = mes.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const mesNome = `${meses[parseInt(mesNum) - 1]} ${ano}`;

    // Header do mês
    doc.setFillColor(99, 102, 241);
    doc.rect(14, yPos, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(mesNome.toUpperCase(), 16, yPos + 6);
    doc.setTextColor(0, 0, 0);
    yPos += 12;

    const dadosTabela = eventosDoMes.map(evento => {
      const data = evento.data_evento.split('-').reverse().join('/');
      const hora = evento.hora_inicio ? evento.hora_inicio.substring(0, 5) : '-';
      const tipos = { 
        'sessao': 'Sessao', 
        'trabalho_irmao': 'Trabalho', 
        'instrucao': 'Instrucao', 
        'sessao_magna': 'S. Magna',
        'sessao_posse': 'S. Posse',
        'sessao_instalacao': 'S. Instalacao',
        'evento_externo': 'Externo', 
        'outro': 'Outro' 
      };
      const statuses = { 
        'planejado': 'Planejado', 
        'confirmado': 'Confirmado', 
        'realizado': 'Realizado', 
        'cancelado': 'Cancelado' 
      };
      return [
        data, 
        hora, 
        tipos[evento.tipo] || evento.tipo, 
        evento.titulo, 
        evento.descricao || '-',
        evento.local || '-'
      ];
    });

    doc.autoTable({
      startY: yPos,
      head: [['Data', 'Hora', 'Tipo', 'Evento', 'Descricao', 'Local']],
      body: dadosTabela,
      theme: 'striped',
      headStyles: { 
        fillColor: [79, 70, 229], 
        textColor: [255, 255, 255], 
        fontSize: 9, 
        fontStyle: 'bold',
        halign: 'center'
      },
      styles: { 
        fontSize: 8, 
        cellPadding: 2.5,
        overflow: 'linebreak'
      },
      columnStyles: { 
        0: { cellWidth: 22, halign: 'center' },   // Data
        1: { cellWidth: 18, halign: 'center' },   // Hora
        2: { cellWidth: 28, halign: 'center' },   // Tipo
        3: { cellWidth: 80 },                     // Evento
        4: { cellWidth: 100 },                    // Descricao (MUITO MAIOR)
        5: { cellWidth: 40 }                      // Local
      },
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(`Pag ${data.pageNumber}/${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
    });

    yPos = doc.lastAutoTable.finalY + 8;
  });

  // Rodapé
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : yPos;
  if (finalY < pageHeight - 30) {
    doc.setDrawColor(200, 200, 200);
    doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('TFA', pageWidth / 2, pageHeight - 14, { align: 'center' });
  }

  const nomeArquivo = `Cronograma_${periodo.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeArquivo);
};

const gerarRelatorioMensal = async (eventos, mes, ano) => {
  const eventosMes = eventos.filter(e => 
    e.data_evento.startsWith(`${ano}-${mes.toString().padStart(2, '0')}`)
  );
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const periodo = `${meses[mes - 1]} ${ano}`;
  await gerarRelatorioCronograma(eventosMes, periodo);
};

const gerarRelatorioSemestral = async (eventos, semestre, ano) => {
  const mesesSemestre = semestre === 1 
    ? ['01', '02', '03', '04', '05', '06']
    : ['07', '08', '09', '10', '11', '12'];
  const eventosSemestre = eventos.filter(e => {
    const mes = e.data_evento.substring(5, 7);
    return e.data_evento.startsWith(ano.toString()) && mesesSemestre.includes(mes);
  });
  const periodo = `${semestre}º Semestre ${ano}`;
  await gerarRelatorioCronograma(eventosSemestre, periodo);
};

const gerarRelatorioAnual = async (eventos, ano) => {
  const eventosAno = eventos.filter(e => 
    e.data_evento.startsWith(ano.toString())
  );
  const periodo = `Anual ${ano}`;
  await gerarRelatorioCronograma(eventosAno, periodo);
};

export default function Cronograma({ showSuccess, showError, userEmail, permissoes }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [visualizacao, setVisualizacao] = useState('lista'); // 'lista' ou 'calendario'
  const [mostrarModalRelatorio, setMostrarModalRelatorio] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState('mensal'); // 'mensal', 'semestral', 'anual'
  const [relatorioForm, setRelatorioForm] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    semestre: 1
  });

  const [eventoForm, setEventoForm] = useState({
    titulo: '',
    tipo: 'sessao',
    descricao: '',
    data_evento: '',
    hora_inicio: '',
    hora_fim: '',
    local: '',
    responsavel: '',
    observacoes: '',
    status: 'planejado',
    cor_destaque: '#3b82f6'
  });

  const tiposEvento = [
    { value: 'sessao', label: '📜 Sessão', cor: '#3b82f6' },
    { value: 'trabalho_irmao', label: '📖 Trabalho de Irmão', cor: '#8b5cf6' },
    { value: 'instrucao', label: '🎓 Instrução', cor: '#10b981' },
    { value: 'sessao_magna', label: '👑 Sessão Magna', cor: '#ef4444' },
    { value: 'sessao_posse', label: '📜 Sessão de Posse', cor: '#10b981' },
    { value: 'sessao_instalacao', label: '👑 Sessão de Instalação', cor: '#3b82f6' },
    { value: 'evento_externo', label: '🌍 Evento Externo', cor: '#f59e0b' },
    { value: 'outro', label: '📌 Outro', cor: '#6b7280' }
  ];

  const statusEvento = [
    { value: 'planejado', label: '📋 Planejado', cor: 'bg-blue-100 text-blue-800' },
    { value: 'confirmado', label: '✅ Confirmado', cor: 'bg-green-100 text-green-800' },
    { value: 'realizado', label: '🎯 Realizado', cor: 'bg-purple-100 text-purple-800' },
    { value: 'cancelado', label: '❌ Cancelado', cor: 'bg-red-100 text-red-800' }
  ];

  useEffect(() => {
    carregarEventos();
  }, []);

  const carregarEventos = async () => {
    console.log('📥 Carregando eventos...');
    setLoading(true);
    
    // Forçar bypass de cache adicionando timestamp
    const { data, error } = await supabase
      .from('cronograma')
      .select('*')
      .order('data_evento', { ascending: true })
      .limit(1000); // Limite para forçar nova query
    
    if (error) {
      console.error('❌ Erro ao carregar eventos:', error);
    } else {
      console.log(`✅ ${data?.length || 0} eventos carregados:`, data);
      setEventos(data || []);
    }
    setLoading(false);
  };

  const limparFormulario = () => {
    setEventoForm({
      titulo: '',
      tipo: 'sessao',
      descricao: '',
      data_evento: '',
      hora_inicio: '',
      hora_fim: '',
      local: '',
      responsavel: '',
      observacoes: '',
      status: 'planejado',
      cor_destaque: '#3b82f6'
    });
    setEventoEditando(null);
    setMostrarFormulario(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!eventoForm.titulo || !eventoForm.data_evento) {
      showError('Preencha o título e a data do evento');
      return;
    }

    try {
      if (eventoEditando) {
        // Ao editar, não envia campos automáticos do banco
        const { id, created_at, updated_at, created_by, ...dadosEdicao } = eventoForm;
        
        console.log('🔄 EDITANDO EVENTO:', {
          id: eventoEditando.id,
          dadosAntigos: eventoEditando,
          dadosNovos: dadosEdicao
        });
        
        const { data, error } = await supabase
          .from('cronograma')
          .update(dadosEdicao)
          .eq('id', eventoEditando.id)
          .select();

        if (error) {
          console.error('❌ Erro ao atualizar:', error);
          showError('Erro ao atualizar evento: ' + error.message);
          return;
        }
        
        console.log('✅ Evento atualizado no banco:', data);
        showSuccess('Evento atualizado com sucesso!');
        
        // Limpar formulário primeiro
        limparFormulario();
        
        // Pequeno delay antes de recarregar
        setTimeout(async () => {
          await carregarEventos();
          console.log('🔄 Eventos recarregados');
        }, 500);
        
      } else {
        // Ao criar, inclui created_by
        const dados = {
          ...eventoForm,
          created_by: userEmail || 'sistema'
        };
        
        console.log('➕ CRIANDO EVENTO:', dados);
        
        const { data, error } = await supabase
          .from('cronograma')
          .insert([dados])
          .select();

        if (error) {
          console.error('❌ Erro ao cadastrar:', error);
          showError('Erro ao cadastrar evento: ' + error.message);
          return;
        }
        
        console.log('✅ Evento criado:', data);
        showSuccess('Evento cadastrado com sucesso!');
        limparFormulario();
        await carregarEventos();
      }
    } catch (error) {
      console.error('❌ Erro geral:', error);
      showError('Erro ao processar: ' + error.message);
    }
  };

  const editarEvento = (evento) => {
    setEventoForm(evento);
    setEventoEditando(evento);
    setMostrarFormulario(true);
  };

  const excluirEvento = async (id) => {
    if (!confirm('Deseja excluir este evento?')) return;

    const { error } = await supabase
      .from('cronograma')
      .delete()
      .eq('id', id);

    if (error) {
      showError('Erro ao excluir evento');
    } else {
      showSuccess('Evento excluído com sucesso!');
      carregarEventos();
    }
  };

  const eventosFiltrados = eventos.filter(e => {
    const filtroTipoOk = !filtroTipo || e.tipo === filtroTipo;
    const filtroMesOk = !filtroMes || e.data_evento.substring(0, 7) === filtroMes;
    return filtroTipoOk && filtroMesOk;
  });

  const agruparPorMes = (eventos) => {
    const grupos = {};
    eventos.forEach(evento => {
      const mes = evento.data_evento.substring(0, 7);
      if (!grupos[mes]) grupos[mes] = [];
      grupos[mes].push(evento);
    });
    return grupos;
  };

  const formatarData = (data) => {
    return data.split('-').reverse().join('/');
  };

  const formatarHora = (hora) => {
    if (!hora) return '';
    return hora.substring(0, 5);
  };

  const formatarMesAno = (mesString) => {
    // mesString vem como "2026-01"
    const [ano, mes] = mesString.split('-');
    const meses = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 
                   'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    return `${meses[parseInt(mes) - 1]} ${ano}`;
  };

  const obterIconeTipo = (tipo) => {
    const tipoObj = tiposEvento.find(t => t.value === tipo);
    return tipoObj ? tipoObj.label.split(' ')[0] : '📌';
  };

  const obterLabelStatus = (status) => {
    const statusObj = statusEvento.find(s => s.value === status);
    return statusObj ? statusObj.label : status;
  };

  const obterCorStatus = (status) => {
    const statusObj = statusEvento.find(s => s.value === status);
    return statusObj ? statusObj.cor : 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="text-center py-12">Carregando cronograma...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">📅 Cronograma Anual</h2>
            <p className="text-indigo-100">Eventos, sessões e atividades da loja</p>
          </div>
          {(permissoes?.canEdit || permissoes?.canEditMembers) && (
            <button
              onClick={() => {
                limparFormulario();
                setMostrarFormulario(!mostrarFormulario);
              }}
              className="px-6 py-3 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors font-semibold"
            >
              {mostrarFormulario ? '✖️ Cancelar' : '➕ Novo Evento'}
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-indigo-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {eventoEditando ? '✏️ Editar Evento' : '➕ Cadastrar Novo Evento'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Título */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título do Evento *
                </label>
                <input
                  type="text"
                  value={eventoForm.titulo}
                  onChange={(e) => setEventoForm({ ...eventoForm, titulo: e.target.value })}
                  placeholder="Ex: Sessão Ordinária de Aprendiz"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={eventoForm.tipo}
                  onChange={(e) => {
                    const tipo = tiposEvento.find(t => t.value === e.target.value);
                    setEventoForm({ 
                      ...eventoForm, 
                      tipo: e.target.value,
                      cor_destaque: tipo ? tipo.cor : '#3b82f6'
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                >
                  {tiposEvento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={eventoForm.status}
                  onChange={(e) => setEventoForm({ ...eventoForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                >
                  {statusEvento.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data *
                </label>
                <input
                  type="date"
                  value={eventoForm.data_evento}
                  onChange={(e) => setEventoForm({ ...eventoForm, data_evento: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Hora Início */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora Início
                </label>
                <input
                  type="time"
                  value={eventoForm.hora_inicio}
                  onChange={(e) => setEventoForm({ ...eventoForm, hora_inicio: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Hora Fim */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora Fim
                </label>
                <input
                  type="time"
                  value={eventoForm.hora_fim}
                  onChange={(e) => setEventoForm({ ...eventoForm, hora_fim: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Local */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Local
                </label>
                <input
                  type="text"
                  value={eventoForm.local}
                  onChange={(e) => setEventoForm({ ...eventoForm, local: e.target.value })}
                  placeholder="Ex: Templo Maçônico"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsável
                </label>
                <input
                  type="text"
                  value={eventoForm.responsavel}
                  onChange={(e) => setEventoForm({ ...eventoForm, responsavel: e.target.value })}
                  placeholder="Ex: Ir∴ João"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Cor Destaque */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cor Destaque
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={eventoForm.cor_destaque}
                    onChange={(e) => setEventoForm({ ...eventoForm, cor_destaque: e.target.value })}
                    className="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={eventoForm.cor_destaque}
                    onChange={(e) => setEventoForm({ ...eventoForm, cor_destaque: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={eventoForm.descricao}
                  onChange={(e) => setEventoForm({ ...eventoForm, descricao: e.target.value })}
                  rows={2}
                  placeholder="Descrição detalhada do evento"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Observações */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={eventoForm.observacoes}
                  onChange={(e) => setEventoForm({ ...eventoForm, observacoes: e.target.value })}
                  rows={2}
                  placeholder="Observações adicionais"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                {eventoEditando ? '💾 Salvar Alterações' : '➕ Cadastrar Evento'}
              </button>
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros e Visualização */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos os Tipos</option>
              {tiposEvento.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setFiltroTipo('');
                setFiltroMes('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              🔄 Limpar
            </button>
          </div>

          {/* Toggle Visualização Lista/Calendário */}
          <div className="flex items-end gap-2 border-l-2 border-gray-300 pl-4">
            <button
              onClick={() => setVisualizacao('lista')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                visualizacao === 'lista'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setVisualizacao('calendario')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                visualizacao === 'calendario'
                  ? 'bg-yellow-700 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              📅 Calendário
            </button>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setTipoRelatorio('mensal');
                setMostrarModalRelatorio(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              title="Gerar PDF mensal"
            >
              📄 Mensal
            </button>
            <button
              onClick={() => {
                setTipoRelatorio('semestral');
                setMostrarModalRelatorio(true);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              title="Gerar PDF semestral"
            >
              📄 Semestral
            </button>
            <button
              onClick={() => {
                setTipoRelatorio('anual');
                setMostrarModalRelatorio(true);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              title="Gerar PDF anual"
            >
              📄 Anual
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <strong>{eventosFiltrados.length}</strong> evento(s) encontrado(s)
          </div>
        </div>
      </div>

      {/* MODAL DE RELATÓRIO */}
      {mostrarModalRelatorio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              📄 Gerar Relatório {tipoRelatorio === 'mensal' ? 'Mensal' : tipoRelatorio === 'semestral' ? 'Semestral' : 'Anual'}
            </h3>

            <div className="space-y-4">
              {tipoRelatorio === 'mensal' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                    <select
                      value={relatorioForm.mes}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, mes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="1">Janeiro</option>
                      <option value="2">Fevereiro</option>
                      <option value="3">Março</option>
                      <option value="4">Abril</option>
                      <option value="5">Maio</option>
                      <option value="6">Junho</option>
                      <option value="7">Julho</option>
                      <option value="8">Agosto</option>
                      <option value="9">Setembro</option>
                      <option value="10">Outubro</option>
                      <option value="11">Novembro</option>
                      <option value="12">Dezembro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                    <input
                      type="number"
                      value={relatorioForm.ano}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, ano: parseInt(e.target.value) })}
                      min="2020"
                      max="2050"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {tipoRelatorio === 'semestral' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semestre</label>
                    <select
                      value={relatorioForm.semestre}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, semestre: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="1">1º Semestre (Jan-Jun)</option>
                      <option value="2">2º Semestre (Jul-Dez)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                    <input
                      type="number"
                      value={relatorioForm.ano}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, ano: parseInt(e.target.value) })}
                      min="2020"
                      max="2050"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {tipoRelatorio === 'anual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                  <input
                    type="number"
                    value={relatorioForm.ano}
                    onChange={(e) => setRelatorioForm({ ...relatorioForm, ano: parseInt(e.target.value) })}
                    min="2020"
                    max="2050"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={async () => {
                  if (tipoRelatorio === 'mensal') {
                    await gerarRelatorioMensal(eventos, relatorioForm.mes, relatorioForm.ano);
                  } else if (tipoRelatorio === 'semestral') {
                    await gerarRelatorioSemestral(eventos, relatorioForm.semestre, relatorioForm.ano);
                  } else {
                    await gerarRelatorioAnual(eventos, relatorioForm.ano);
                  }
                  setMostrarModalRelatorio(false);
                  showSuccess('Relatório gerado com sucesso!');
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                📄 Gerar PDF
              </button>
              <button
                onClick={() => setMostrarModalRelatorio(false)}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo - Lista ou Calendário */}
      {visualizacao === 'lista' ? (
        /* Lista de Eventos */
        <div className="space-y-6">
          {Object.entries(agruparPorMes(eventosFiltrados)).map(([mes, eventosDoMes]) => (
          <div key={mes} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div 
              className="p-4"
              style={{ background: 'linear-gradient(to right, #4f46e5, #7c3aed)' }}
            >
              <h3 className="text-xl font-bold text-white">
                📆 {formatarMesAno(mes)}
              </h3>
              <p className="text-indigo-100 text-sm">{eventosDoMes.length} evento(s)</p>
            </div>

            <div className="p-4 space-y-3">
              {eventosDoMes.map((evento) => (
                <div
                  key={evento.id}
                  className="border-l-4 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  style={{ borderColor: evento.cor_destaque }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{obterIconeTipo(evento.tipo)}</span>
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{evento.titulo}</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${obterCorStatus(evento.status)}`}>
                              {obterLabelStatus(evento.status)}
                            </span>
                            <span className="text-sm text-gray-600">
                              📅 {formatarData(evento.data_evento)}
                            </span>
                            {evento.hora_inicio && (
                              <span className="text-sm text-gray-600">
                                🕐 {formatarHora(evento.hora_inicio)}
                                {evento.hora_fim && ` - ${formatarHora(evento.hora_fim)}`}
                              </span>
                            )}
                            {evento.local && (
                              <span className="text-sm text-gray-600">
                                📍 {evento.local}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {evento.descricao && (
                        <p className="text-sm text-gray-700 mt-2">{evento.descricao}</p>
                      )}

                      {evento.responsavel && (
                        <p className="text-sm text-gray-600 mt-1">
                          <strong>Responsável:</strong> {evento.responsavel}
                        </p>
                      )}

                      {evento.observacoes && (
                        <p className="text-sm text-gray-500 italic mt-1">{evento.observacoes}</p>
                      )}
                    </div>

                    {(permissoes?.canEdit || permissoes?.canEditMembers) && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => editarEvento(evento)}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluirEvento(evento.id)}
                          className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {eventosFiltrados.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-gray-600 text-lg font-medium">Nenhum evento cadastrado</p>
            <p className="text-gray-500 text-sm mt-2">Clique em "Novo Evento" para começar</p>
          </div>
        )}
      </div>
      ) : (
        /* Visualização em Calendário */
        <CalendarioAnual 
          eventos={eventos.map(e => ({
            data: e.data_evento,
            titulo: e.titulo,
            tipo: e.tipo,
            cor: e.cor_destaque
          }))} 
          ano={new Date().getFullYear()}
        />
      )}
    </div>
  );
}
