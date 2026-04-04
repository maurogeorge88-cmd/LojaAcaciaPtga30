import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import CalendarioAnual from './CalendarioAnual';

// Funções de geração de PDF (inline para evitar problemas de import)
const gerarRelatorioCronograma = async (eventos, periodo, logoLojaBase64 = null) => {
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
  
  // 1️⃣ LOGO DA LOJA à direita (não símbolo maçônico)
  if (logoLojaBase64) {
    try {
      doc.addImage(logoLojaBase64, 'PNG', pageWidth - 32, 7, 22, 22);
    } catch (e) {
      console.log('Erro ao adicionar logo da loja');
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

  // 3️⃣ Info do relatório (SEM data de emissão)
  let yPos = 42;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Total de eventos: ${eventos.length}`, pageWidth - 14, yPos, { align: 'right' });
  
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

  // Helper para nome do grau
  const getGrauNome = (grauId) => {
    switch(grauId) {
      case 1: return 'Aprendiz';
      case 2: return 'Companheiro';
      case 3: return 'Mestre';
      case 4: return 'Evento Loja';
      default: return '';
    }
  };

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
      // Data + Hora juntas
      const data = evento.data_evento.split('-').reverse().join('/');
      const hora = evento.hora_inicio ? evento.hora_inicio.substring(0, 5) : '';
      const dataHora = hora ? `${data}\n${hora}` : data;
      
      // 2️⃣ Tipos COMPLETOS (sem abreviação)
      const tipos = { 
        'sessao': 'Sessao', 
        'trabalho_irmao': 'Trabalho', 
        'instrucao': 'Instrucao', 
        'sessao_magna': 'Sessao Magna',
        'sessao_posse': 'Sessao de Posse',
        'sessao_instalacao': 'Sessao de Instalacao',
        'evento_externo': 'Evento Externo', 
        'outro': 'Outro' 
      };
      
      // Tipo + Grau
      const tipo = tipos[evento.tipo] || evento.tipo;
      const grau = getGrauNome(evento.grau_sessao_id);
      const tipoGrau = grau ? `${tipo}\n${grau}` : tipo;
      
      return [
        dataHora,           // Data + Hora
        tipoGrau,          // Tipo + Grau (nomes completos)
        evento.titulo,     // Evento
        evento.descricao || '-',  // Descrição
        evento.local || '-',      // Local
        evento.observacoes || '-' // Observações
      ];
    });

    doc.autoTable({
      startY: yPos,
      head: [['Data/Hora', 'Tipo/Grau', 'Evento', 'Descricao', 'Local', 'Observacoes']],
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
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      columnStyles: { 
        0: { cellWidth: 25, halign: 'center' },    // Data/Hora
        1: { cellWidth: 35, halign: 'center' },    // Tipo/Grau (aumentado para nomes completos)
        2: { cellWidth: 55 },                      // Evento
        3: { cellWidth: 75 },                      // Descrição
        4: { cellWidth: 35 },                      // Local
        5: { cellWidth: 45 }                       // Observações
      },
      margin: { left: 14, right: 14 },
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
  // Buscar logo da loja
  const { data: dadosLoja } = await supabase
    .from('dados_loja')
    .select('logo_url')
    .single();
  
  const eventosMes = eventos.filter(e => 
    e.data_evento.startsWith(`${ano}-${mes.toString().padStart(2, '0')}`)
  );
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const periodo = `${meses[mes - 1]} ${ano}`;
  await gerarRelatorioCronograma(eventosMes, periodo, dadosLoja?.logo_url);
};

const gerarRelatorioSemestral = async (eventos, semestre, ano) => {
  // Buscar logo da loja
  const { data: dadosLoja } = await supabase
    .from('dados_loja')
    .select('logo_url')
    .single();
  
  const mesesSemestre = semestre === 1 
    ? ['01', '02', '03', '04', '05', '06']
    : ['07', '08', '09', '10', '11', '12'];
  const eventosSemestre = eventos.filter(e => {
    const mes = e.data_evento.substring(5, 7);
    return e.data_evento.startsWith(ano.toString()) && mesesSemestre.includes(mes);
  });
  const periodo = `${semestre}º Semestre ${ano}`;
  await gerarRelatorioCronograma(eventosSemestre, periodo, dadosLoja?.logo_url);
};

const gerarRelatorioAnual = async (eventos, ano) => {
  // Buscar logo da loja
  const { data: dadosLoja } = await supabase
    .from('dados_loja')
    .select('logo_url')
    .single();
  
  const eventosAno = eventos.filter(e => 
    e.data_evento.startsWith(ano.toString())
  );
  const periodo = `Anual ${ano}`;
  await gerarRelatorioCronograma(eventosAno, periodo, dadosLoja?.logo_url);
};

export default function Cronograma({ showSuccess, showError, userEmail, permissoes }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modalVisualizacao, setModalVisualizacao] = useState(false);
  // Meses abertos: atual e futuros abertos por padrão, passados recolhidos
  const mesAtualKey = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
  const [mesesAbertos, setMesesAbertos] = useState({});
  const isMesAberto = (mesKey) => {
    if (mesKey in mesesAbertos) return mesesAbertos[mesKey];
    return mesKey >= mesAtualKey; // atual e futuros abertos, passados fechados
  };
  const toggleMes = (mesKey) => setMesesAbertos(prev => ({...prev, [mesKey]: !isMesAberto(mesKey)}));
  const [eventoVisualizar, setEventoVisualizar] = useState(null);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [visualizacao, setVisualizacao] = useState('lista'); // 'lista' ou 'calendario'
  const [mostrarModalRelatorio, setMostrarModalRelatorio] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState('mensal'); // 'mensal', 'semestral', 'anual'
  const [tema, setTema] = useState({
    cor_primaria: '#4f46e5',
    cor_secundaria: '#818cf8',
    cor_destaque: '#eab308'
  });
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
    cor_destaque: '#3b82f6',
    grau_sessao_id: 1 // Padrão: Aprendiz (todos podem participar)
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
    { value: 'planejado', label: '📋 Planejado', cor: ' ',
      style: {background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'} },
    { value: 'confirmado', label: '✅ Confirmado', cor: ' ',
      style: {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'} },
    { value: 'realizado', label: '🎯 Realizado', cor: ' ',
      style: {background:'rgba(139,92,246,0.15)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)'} },
    { value: 'cancelado', label: '❌ Cancelado', cor: ' ',
      style: {background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'} }
  ];

  // Helper para nome do grau
  const getGrauNome = (grauId) => {
    switch(grauId) {
      case 1: return '⬜ Aprendiz';
      case 2: return '🔷 Companheiro';
      case 3: return '🔺 Mestre';
      case 4: return '🏛️ Evento Loja';
      default: return '';
    }
  };

  useEffect(() => {
    carregarEventos();
    carregarTema();
  }, []);

  const carregarTema = async () => {
    try {
      const { data, error } = await supabase
        .from('dados_loja')
        .select('cor_primaria, cor_secundaria, cor_destaque')
        .single();
      
      if (error) {
        console.log('Usando tema padrão (sem dados_loja configurado)');
        return;
      }
      
      if (data) {
        setTema({
          cor_primaria: data.cor_primaria || '#4f46e5',
          cor_secundaria: data.cor_secundaria || '#818cf8',
          cor_destaque: data.cor_destaque || '#eab308'
        });
      }
    } catch (error) {
      console.log('Erro ao carregar tema, usando padrão:', error.message);
    }
  };

  useEffect(() => {
    carregarEventos();
  }, []);

  const carregarEventos = async () => {
    console.log('📥 Carregando eventos...');
    setLoading(true);
    
    // Adicionar filtro com timestamp para evitar cache
    const { data, error } = await supabase
      .from('cronograma')
      .select('*')
      .or(`id.gte.0,updated_at.gte.1970-01-01`)  // Força query nova
      .order('data_evento', { ascending: true });
    
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
      cor_destaque: '#3b82f6',
      grau_sessao_id: 1
    });
    setEventoEditando(null);
    setMostrarFormulario(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!eventoForm.titulo || !eventoForm.data_evento) {
      showError('Preencha o título e a data');
      return;
    }

    try {
      if (eventoEditando) {
        // EDIÇÃO
        const { error } = await supabase
          .from('cronograma')
          .update({
            titulo: eventoForm.titulo,
            tipo: eventoForm.tipo,
            descricao: eventoForm.descricao,
            data_evento: eventoForm.data_evento,
            hora_inicio: eventoForm.hora_inicio,
            hora_fim: eventoForm.hora_fim,
            local: eventoForm.local,
            responsavel: eventoForm.responsavel,
            observacoes: eventoForm.observacoes,
            status: eventoForm.status,
            cor_destaque: eventoForm.cor_destaque,
            grau_sessao_id: eventoForm.grau_sessao_id
          })
          .eq('id', eventoEditando.id);

        if (error) throw error;
        
        showSuccess('Atualizado!');
      } else {
        // CRIAÇÃO
        const { error } = await supabase
          .from('cronograma')
          .insert([{
            titulo: eventoForm.titulo,
            tipo: eventoForm.tipo,
            descricao: eventoForm.descricao,
            data_evento: eventoForm.data_evento,
            hora_inicio: eventoForm.hora_inicio,
            hora_fim: eventoForm.hora_fim,
            local: eventoForm.local,
            responsavel: eventoForm.responsavel,
            observacoes: eventoForm.observacoes,
            status: eventoForm.status,
            cor_destaque: eventoForm.cor_destaque,
            grau_sessao_id: eventoForm.grau_sessao_id,
            created_by: userEmail || 'sistema'
          }]);

        if (error) throw error;
        
        showSuccess('Criado!');
      }

      limparFormulario();
      await carregarEventos();
      
    } catch (error) {
      showError('Erro: ' + error.message);
    }
  };

  const editarEvento = async (evento) => {
    const { data } = await supabase
      .from('cronograma')
      .select('*')
      .eq('id', evento.id)
      .single();
    
    if (data) {
      setEventoForm(data);
      setEventoEditando(data);
      setMostrarFormulario(true);
      
      // Scroll suave para o topo
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
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

  const obterStyleStatus = (status) => {
    const s = statusEvento.find(s => s.value === status);
    return s ? s.style : {background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'};
  };
  const obterCorStatus = (status) => {
    const statusObj = statusEvento.find(s => s.value === status);
    return statusObj ? statusObj.cor : ' ';
  };

  if (loading) {
    return <div className="text-center py-12">Carregando cronograma...</div>;
  }

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* Header */}
      <div 
        className="text-white rounded-lg p-6"
        style={{ 
          background: 'var(--color-accent)'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2" style={{color:"#fff"}}>📅 Cronograma Anual</h2>
            <p className="opacity-90">Eventos, sessões e atividades da loja</p>
          </div>
          {(permissoes?.canEdit || permissoes?.canEditMembers) && (
            <button
              onClick={() => {
                if (!mostrarFormulario) {
                  limparFormulario();
                  setMostrarFormulario(true);
                  // Scroll para o topo
                  setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }, 100);
                } else {
                  setMostrarFormulario(false);
                }
              }}
              className="px-6 py-3 rounded-lg hover:opacity-90 transition-opacity font-semibold"
              style={{ color: '#000080' }}
            >
              {mostrarFormulario ? '✖️ Cancelar' : '➕ Novo Evento'}
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      {mostrarFormulario && (
        <div 
          key={eventoEditando?.id || 'novo'} 
          className="rounded-lg p-6 border-2"
          style={{ borderColor: tema.cor_primaria }}
        >
          <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>
            {eventoEditando ? '✏️ Editar Evento' : '➕ Cadastrar Novo Evento'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Título */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Título do Evento *
                </label>
                <input
                  type="text"
                  value={eventoForm.titulo}
                  onChange={(e) => setEventoForm({ ...eventoForm, titulo: e.target.value })}
                  placeholder="Ex: Sessão Ordinária de Aprendiz"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
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
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  {tiposEvento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              {/* Grau da Sessão */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Grau Mínimo Requerido *
                </label>
                <select
                  value={eventoForm.grau_sessao_id}
                  onChange={(e) => setEventoForm({ ...eventoForm, grau_sessao_id: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  <option value={1}>⬜ Aprendiz (Todos)</option>
                  <option value={2}>🔷 Companheiro (Comp. e Mestres)</option>
                  <option value={3}>🔺 Mestre (Somente Mestres)</option>
                  <option value={4}>🏛️ Evento Loja (Geral)</option>
                </select>
                <p className="text-xs mt-1">Define quem pode participar da sessão</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Status
                </label>
                <select
                  value={eventoForm.status}
                  onChange={(e) => setEventoForm({ ...eventoForm, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  {statusEvento.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Data *
                </label>
                <input
                  type="date"
                  value={eventoForm.data_evento}
                  onChange={(e) => setEventoForm({ ...eventoForm, data_evento: e.target.value })}
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  required
                />
              </div>

              {/* Hora Início */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Hora Início
                </label>
                <input
                  type="time"
                  value={eventoForm.hora_inicio}
                  onChange={(e) => setEventoForm({ ...eventoForm, hora_inicio: e.target.value })}
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Hora Fim */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Hora Fim
                </label>
                <input
                  type="time"
                  value={eventoForm.hora_fim}
                  onChange={(e) => setEventoForm({ ...eventoForm, hora_fim: e.target.value })}
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Local */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Local
                </label>
                <textarea
                  value={eventoForm.local}
                  onChange={(e) => setEventoForm({ ...eventoForm, local: e.target.value })}
                  placeholder="Ex: Templo da Loja&#10;Almoço: Espaço Realize"
                  rows="2"
                  className="w-full px-3 py-2 border rounded resize-none" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
                <p className="text-xs mt-1">Pressione Enter para quebrar linha</p>
              </div>

              {/* Responsável */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Responsável
                </label>
                <input
                  type="text"
                  value={eventoForm.responsavel}
                  onChange={(e) => setEventoForm({ ...eventoForm, responsavel: e.target.value })}
                  placeholder="Ex: Ir∴ João"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Cor Destaque */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Cor Destaque
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={eventoForm.cor_destaque}
                    onChange={(e) => setEventoForm({ ...eventoForm, cor_destaque: e.target.value })}
                    className="w-16 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={eventoForm.cor_destaque}
                    onChange={(e) => setEventoForm({ ...eventoForm, cor_destaque: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Descrição
                </label>
                <textarea
                  value={eventoForm.descricao}
                  onChange={(e) => setEventoForm({ ...eventoForm, descricao: e.target.value })}
                  rows={2}
                  placeholder="Descrição detalhada do evento"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>

              {/* Observações */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>
                  Observações
                </label>
                <textarea
                  value={eventoForm.observacoes}
                  onChange={(e) => setEventoForm({ ...eventoForm, observacoes: e.target.value })}
                  rows={2}
                  placeholder="Observações adicionais"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                style={{ backgroundColor: tema.cor_primaria }}
              >
                {eventoEditando ? '💾 Salvar Alterações' : '➕ Cadastrar Evento'}
              </button>
              <button
                type="button"
                onClick={limparFormulario}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros e Visualização */}
      <div className="rounded-lg shadow p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="">Todos os Tipos</option>
              {tiposEvento.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Mês</label>
            <input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setFiltroTipo('');
                setFiltroMes('');
              }}
              className="px-4 py-2 rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              🔄 Limpar
            </button>
          </div>

          {/* Toggle Visualização Lista/Calendário */}
          <div className="flex items-end gap-2 border-l-2 pl-4">
            <button
              onClick={() => setVisualizacao('lista')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                visualizacao === 'lista'
                  ? 'bg-primary-600 text-white'
                  : 'btn-tab-inactive'
              }`}
            >
              📋 Lista
            </button>
            <button
              onClick={() => setVisualizacao('calendario')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                visualizacao === 'calendario'
                  ? 'btn-yellow-placeholder'
                  : 'btn-tab-inactive'
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
              style={{padding:"0.4rem 1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600",fontSize:"0.82rem"}}
              title="Gerar PDF mensal"
            >
              📄 Mensal
            </button>
            <button
              onClick={() => {
                setTipoRelatorio('semestral');
                setMostrarModalRelatorio(true);
              }}
              style={{padding:"0.4rem 1rem",background:"#8b5cf6",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600",fontSize:"0.82rem"}}
              title="Gerar PDF semestral"
            >
              📄 Semestral
            </button>
            <button
              onClick={() => {
                setTipoRelatorio('anual');
                setMostrarModalRelatorio(true);
              }}
              style={{padding:"0.4rem 1rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600",fontSize:"0.82rem"}}
              title="Gerar PDF anual"
            >
              📄 Anual
            </button>
          </div>

          <div className="text-sm">
            <strong>{eventosFiltrados.length}</strong> evento(s) encontrado(s)
          </div>
        </div>
      </div>

      {/* MODAL DE RELATÓRIO */}
      {mostrarModalRelatorio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-md w-full p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>
              📄 Gerar Relatório {tipoRelatorio === 'mensal' ? 'Mensal' : tipoRelatorio === 'semestral' ? 'Semestral' : 'Anual'}
            </h3>

            <div className="space-y-4">
              {tipoRelatorio === 'mensal' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Mês</label>
                    <select
                      value={relatorioForm.mes}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, mes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Ano</label>
                    <input
                      type="number"
                      value={relatorioForm.ano}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, ano: parseInt(e.target.value) })}
                      min="2020"
                      max="2050"
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  </div>
                </>
              )}

              {tipoRelatorio === 'semestral' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Semestre</label>
                    <select
                      value={relatorioForm.semestre}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, semestre: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    >
                      <option value="1">1º Semestre (Jan-Jun)</option>
                      <option value="2">2º Semestre (Jul-Dez)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Ano</label>
                    <input
                      type="number"
                      value={relatorioForm.ano}
                      onChange={(e) => setRelatorioForm({ ...relatorioForm, ano: parseInt(e.target.value) })}
                      min="2020"
                      max="2050"
                      className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                    />
                  </div>
                </>
              )}

              {tipoRelatorio === 'anual' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Ano</label>
                  <input
                    type="number"
                    value={relatorioForm.ano}
                    onChange={(e) => setRelatorioForm({ ...relatorioForm, ano: parseInt(e.target.value) })}
                    min="2020"
                    max="2050"
                    className="w-full px-3 py-2 border rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
                style={{flex:1,padding:"0.5rem 1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                📄 Gerar PDF
              </button>
              <button
                onClick={() => setMostrarModalRelatorio(false)}
                className="flex-1 px-4 py-2 rounded-lg" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
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
          <div key={mes} style={{borderRadius:'var(--radius-xl)',overflow:'hidden',border:'1px solid var(--color-border)',marginBottom:'0.5rem'}}>
            <div
              onClick={() => toggleMes(mes)}
              style={{padding:'0.85rem 1.25rem',background:mes<mesAtualKey?'var(--color-surface-2)':'var(--color-accent)',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',userSelect:'none'}}
            >
              <div>
                <h3 style={{fontSize:'1.05rem',fontWeight:'700',color:mes<mesAtualKey?'var(--color-text-muted)':'#fff',margin:0}}>
                  📆 {formatarMesAno(mes)}
                  {mes < mesAtualKey && <span style={{fontSize:'0.72rem',marginLeft:'0.5rem',opacity:0.7}}>(passado)</span>}
                </h3>
                <p style={{fontSize:'0.78rem',color:mes<mesAtualKey?'var(--color-text-muted)':'rgba(255,255,255,0.8)',margin:'0.1rem 0 0'}}>{eventosDoMes.length} evento(s)</p>
              </div>
              <span style={{fontSize:'1rem',color:mes<mesAtualKey?'var(--color-text-muted)':'rgba(255,255,255,0.8)',transition:'transform 0.2s',display:'inline-block',transform:isMesAberto(mes)?'rotate(0deg)':'rotate(-90deg)'}}>▼</span>
            </div>

            {isMesAberto(mes) && <div className="p-4 space-y-3" style={{background:'var(--color-surface)'}}>
              {eventosDoMes.map((evento, evIdx) => (
                <div
                  key={evento.id}
                  className="border-l-4 rounded-lg p-4 transition-colors"
                  style={{ borderColor: evento.cor_destaque, background: evIdx%2===0 ? "var(--color-surface)" : "var(--color-surface-2)", marginBottom:"0.5rem" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{obterIconeTipo(evento.tipo)}</span>
                        <div>
                          <h4 style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)",margin:0}}>{evento.titulo}</h4>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <span style={{...obterStyleStatus(evento.status),padding:"0.15rem 0.55rem",borderRadius:"var(--radius-sm)",fontSize:"0.7rem",fontWeight:"700"}}>
                              {obterLabelStatus(evento.status)}
                            </span>
                            {evento.grau_sessao_id && (
                              <span 
                                className="px-2 py-1 rounded text-xs font-bold"
                                style={{ 
                                  backgroundColor: `${tema.cor_primaria}20`,
                                  color: tema.cor_primaria
                                }}
                              >
                                {getGrauNome(evento.grau_sessao_id)}
                              </span>
                            )}
                            <span style={{fontSize:"0.8rem",color:"var(--color-text-muted)"}}>📅 {formatarData(evento.data_evento)}</span>
                            {evento.hora_inicio && (
                              <span style={{fontSize:"0.8rem",color:"var(--color-text-muted)"}}>🕐 {formatarHora(evento.hora_inicio)}
                                {evento.hora_fim && ` - ${formatarHora(evento.hora_fim)}`}
                              </span>
                            )}
                            {evento.local && (
                              <span style={{fontSize:"0.8rem",color:"var(--color-text-muted)"}}>📍 {evento.local}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {evento.descricao && (
                        <p style={{fontSize:"0.82rem",color:"var(--color-text)",margin:"0.4rem 0 0"}}>{evento.descricao}</p>
                      )}

                      {evento.responsavel && (
                        <p className="text-sm mt-1" style={{color:"var(--color-text-muted)"}}>
                          <strong>Responsável:</strong> {evento.responsavel}
                        </p>
                      )}

                      {evento.observacoes && (
                        <p className="text-sm italic mt-1" style={{color:"var(--color-text-muted)"}}>{evento.observacoes}</p>
                      )}
                    </div>

                    {(permissoes?.canEdit || permissoes?.canEditMembers) && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => {
                            setEventoVisualizar(evento);
                            setModalVisualizacao(true);
                          }}
                          style={{padding:"0.25rem 0.55rem",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                          title="Visualizar"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => editarEvento(evento)}
                          style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => excluirEvento(evento.id)}
                          style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>}
          </div>
        ))}

        {eventosFiltrados.length === 0 && (
          <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="text-6xl mb-4">📅</div>
            <p className="text-lg font-medium">Nenhum evento cadastrado</p>
            <p className="text-sm mt-2">Clique em "Novo Evento" para começar</p>
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

      {/* Modal de Visualização */}
      {modalVisualizacao && eventoVisualizar && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setModalVisualizacao(false)}
        >
          <div 
            className="rounded-xl max-w-2xl w-full" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",boxShadow:"var(--shadow-xl)"}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 rounded-t-xl text-white" style={{background:"var(--color-accent)"}}>
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>📅 Detalhes do Evento</h3>
                <button
                  onClick={() => setModalVisualizacao(false)}
                  style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1rem",fontWeight:"700"}}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4" style={{background:"var(--color-surface)",padding:"1.5rem"}}>
              <div>
                <h4 className="text-2xl font-bold mb-2">{eventoVisualizar.titulo}</h4>
                <div className="flex items-center gap-2 mb-3">
                  <span 
                    className="inline-block px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: tiposEvento.find(t => t.value === eventoVisualizar.tipo)?.cor || '#6b7280' }}
                  >
                    {tiposEvento.find(t => t.value === eventoVisualizar.tipo)?.label || eventoVisualizar.tipo}
                  </span>
                  {eventoVisualizar.grau_sessao_id && (
                    <span 
                      className="inline-block px-3 py-1 rounded-full text-sm font-medium"
                      style={{ 
                        backgroundColor: `${tema.cor_primaria}20`,
                        color: tema.cor_primaria
                      }}
                    >
                      {getGrauNome(eventoVisualizar.grau_sessao_id)}
                    </span>
                  )}
                </div>
              </div>
              
              {eventoVisualizar.descricao && (
                <div className="rounded-lg p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <p>{eventoVisualizar.descricao}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm mb-1">📅 Data</p>
                  <p className="font-semibold">{eventoVisualizar.data_evento}</p>
                </div>
                {eventoVisualizar.hora_inicio && (
                  <div>
                    <p className="text-sm mb-1">🕐 Início</p>
                    <p className="font-semibold">{eventoVisualizar.hora_inicio}</p>
                  </div>
                )}
                {eventoVisualizar.local && (
                  <div className="col-span-2">
                    <p className="text-sm mb-1">📍 Local</p>
                    <p className="font-semibold">{eventoVisualizar.local}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
