import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import CalendarioAnual from './CalendarioAnual';
import { TIPOS_EVENTO, corDoEvento, rotuloDoTipo } from './tiposEvento';

// Imagens decorativas do quadro de evento — bucket público "cronograma" no Supabase Storage
const IMG_SOL = supabase.storage.from('cronograma').getPublicUrl('sol.png').data.publicUrl;
const IMG_LUA = supabase.storage.from('cronograma').getPublicUrl('lua.png').data.publicUrl;
const IMG_COLUNA_B = supabase.storage.from('cronograma').getPublicUrl('coluna-b.png').data.publicUrl;
const IMG_COLUNA_J = supabase.storage.from('cronograma').getPublicUrl('coluna-j.png').data.publicUrl;

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
      case 5: return 'Sessão Administrativa';
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
        'sessao_festiva': 'Sessao Festiva',
        'feriado': 'Feriado',
        'evento_externo': 'Evento Externo', 
        'outro': 'Outro' 
      };
      
      // Tipo + Grau
      const tipo = tipos[evento.tipo] || evento.tipo;
      const grau = evento.tipo === 'feriado' ? '' : getGrauNome(evento.grau_sessao_id); // feriado não tem grau
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
  const [filtroMes, setFiltroMes] = useState(''); // '' = todos os meses; senão 'MM'
  const anoAtual = new Date().getFullYear();
  const [anoFiltro, setAnoFiltro] = useState(anoAtual); // 0 = Todos (última opção); padrão = ano atual
  const [mesFiltroInicializado, setMesFiltroInicializado] = useState(false);
  const [visualizacao, setVisualizacao] = useState('lista'); // 'lista' ou 'calendario'
  const [mostrarModalRelatorio, setMostrarModalRelatorio] = useState(false);
  const [tipoRelatorio, setTipoRelatorio] = useState('mensal'); // 'mensal', 'semestral', 'anual'
  const [tema, setTema] = useState({
    cor_primaria: '#4f46e5',
    cor_secundaria: '#818cf8',
    cor_destaque: '#eab308'
  });
  const [dadosLoja, setDadosLoja] = useState({ logo_url: '', nome_loja: '' });
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

  const tiposEvento = TIPOS_EVENTO;

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
      case 5: return '📋 Sessão Administrativa';
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
        .select('cor_primaria, cor_secundaria, cor_destaque, logo_url, nome_loja')
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
        setDadosLoja({
          logo_url: data.logo_url || '',
          nome_loja: data.nome_loja || 'A∴R∴L∴S∴ Acácia de Paranatinga nº 30'
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
    setLoading(true);
    const { data, error } = await supabase
      .from('cronograma')
      .select('*')
      .order('data_evento', { ascending: true });

    if (error) {
      console.error('Erro ao carregar eventos:', error);
    } else {
      setEventos(data || []);
    }
    setLoading(false);
  };

  // ─── Ano: só anos com evento cadastrado; padrão = ano atual ───────────────
  // Se o ano atual ainda não tem evento, mostra o ano anterior mais recente (e avisa).
  const hojeStr = `${anoAtual}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const anoDoEvento = (e) => parseInt(String(e.data_evento).slice(0, 4), 10);
  const anosDisponiveis = [...new Set(eventos.map(anoDoEvento).filter(Boolean))].sort((a, b) => b - a);
  const qtdPorAno = {};
  eventos.forEach(e => { const a = anoDoEvento(e); if (a) qtdPorAno[a] = (qtdPorAno[a] || 0) + 1; });
  const anoAtualTemEvento = anosDisponiveis.includes(anoAtual);
  const anoExibido = (anoFiltro === 0 || anosDisponiveis.includes(anoFiltro))
    ? anoFiltro
    : (anosDisponiveis.find(a => a < anoAtual) ?? anosDisponiveis[0] ?? 0);

  // ─── Mês inicial: mês vigente, ou o próximo mês com evento, ou o último mês ─────
  // com evento — só quando o ano exibido é o ano atual. Roda uma vez, ao carregar.
  useEffect(() => {
    if (loading || mesFiltroInicializado) return;
    setMesFiltroInicializado(true);
    if (eventos.length === 0 || anoExibido !== anoAtual) return;

    const mesesDoAno = [...new Set(eventos.filter(e => anoDoEvento(e) === anoAtual).map(e => e.data_evento.substring(5, 7)))].sort();
    const mesAtualNum = mesAtualKey.substring(5, 7);
    let escolhido = '';
    if (mesesDoAno.includes(mesAtualNum)) escolhido = mesAtualNum;
    else escolhido = mesesDoAno.find(m => m > mesAtualNum) || mesesDoAno[mesesDoAno.length - 1] || '';
    setFiltroMes(escolhido);
  }, [eventos, loading, mesFiltroInicializado]);

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

  const podeEditar = !!(permissoes?.canEdit || permissoes?.canEditMembers);
  const eventosDoAno = eventos.filter(e => anoExibido === 0 || anoDoEvento(e) === anoExibido);
  const eventosPorTipo = eventosDoAno.filter(e => !filtroTipo || e.tipo === filtroTipo);
  const eventosFiltrados = eventosPorTipo.filter(e => !filtroMes || e.data_evento.substring(5, 7) === filtroMes);
  const qtdPorMes = {};
  eventosPorTipo.forEach(e => { const m = e.data_evento.substring(5, 7); qtdPorMes[m] = (qtdPorMes[m] || 0) + 1; });
  const filtrosAtivos = !!(filtroTipo || (visualizacao === 'lista' && filtroMes)); // no calendário o mês não se aplica
  const totalMostrado = visualizacao === 'lista' ? eventosFiltrados.length : eventosPorTipo.length;

  // Indicadores
  // Feriado é só informativo: não tem sessão a registrar, então fica fora das pendências,
  // dos chips de situação e do "próximo evento".
  const proximoEvento = eventos.find(e => e.data_evento >= hojeStr && e.status !== 'cancelado' && e.tipo !== 'feriado') || null;
  const contagemStatus = {};
  eventosDoAno.filter(e => e.tipo !== 'feriado').forEach(e => { contagemStatus[e.status] = (contagemStatus[e.status] || 0) + 1; });
  const qtdFeriados = eventosDoAno.filter(e => e.tipo === 'feriado').length;
  const sessoesDoAno = eventosDoAno.filter(e => String(e.tipo).startsWith('sessao') && e.status !== 'cancelado');
  const sessoesRealizadas = sessoesDoAno.filter(e => e.status === 'realizado').length;
  const pendencias = eventosDoAno.filter(e => e.tipo !== 'feriado' && e.data_evento < hojeStr && ['planejado', 'confirmado'].includes(e.status));
  const anoCalendario = anoExibido || anoAtual;
  const eventosCalendario = eventosPorTipo.map(e => ({ data: e.data_evento, titulo: e.titulo, tipo: e.tipo, cor: corDoEvento(e.tipo, e.cor_destaque) }));

  const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const DIAS_COMPLETOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const diasAte = (dataStr) => Math.round((new Date(dataStr + 'T00:00:00') - new Date(hojeStr + 'T00:00:00')) / 86400000);
  const relativo = (dataStr) => {
    const n = diasAte(dataStr);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
  };

  const rotuloKpi = { margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const cartaoKpi = (cor) => ({ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: `3px solid ${cor}`, borderRadius: 'var(--radius-xl)', padding: '1rem 1.1rem', minWidth: 0 });
  const chip = { fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.55rem', borderRadius: 999, background: 'var(--color-surface-2)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-muted)' };
  const btnBaseTela = { height: '2.6rem', padding: '0 1.2rem', borderRadius: 'var(--radius-lg)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' };

  const renderEvento = (evento) => {
    const cor = corDoEvento(evento.tipo, evento.cor_destaque);
    const d = new Date(evento.data_evento + 'T00:00:00');
    const ehHoje = evento.data_evento === hojeStr;
    const cancelado = evento.status === 'cancelado';
    return (
      <div key={evento.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--color-border)', opacity: cancelado ? 0.6 : 1 }}>
        {/* Bloco de calendário */}
        <div style={{ width: 54, flexShrink: 0, textAlign: 'center', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-bg)' }}>
          <div style={{ background: cor, color: '#fff', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em', padding: '0.1rem 0' }}>{MESES_ABREV[d.getMonth()].toUpperCase()}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.15 }}>{String(d.getDate()).padStart(2, '0')}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', paddingBottom: '0.15rem' }}>{DIAS_ABREV[d.getDay()]}</div>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', textDecoration: cancelado ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{evento.titulo}</h4>
            {ehHoje && <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.5rem', borderRadius: 999, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)' }}>HOJE</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
            <span style={{ padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, color: cor, background: `${cor}22`, border: `1px solid ${cor}66` }}>{rotuloDoTipo(evento.tipo)}</span>
            {evento.tipo !== 'feriado' && (
              <span style={{ ...obterStyleStatus(evento.status), padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700 }}>{obterLabelStatus(evento.status)}</span>
            )}
            {evento.tipo !== 'feriado' && evento.grau_sessao_id && getGrauNome(evento.grau_sessao_id) && (
              <span style={{ ...chip, color: 'var(--color-text)' }}>{getGrauNome(evento.grau_sessao_id)}</span>
            )}
          </div>
          {(evento.hora_inicio || evento.local || evento.responsavel) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1.1rem', marginTop: '0.45rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {evento.hora_inicio && <span>🕐 {formatarHora(evento.hora_inicio)}{evento.hora_fim && ` – ${formatarHora(evento.hora_fim)}`}</span>}
              {evento.local && <span>📍 {evento.local}</span>}
              {evento.responsavel && <span>👤 {evento.responsavel}</span>}
            </div>
          )}
          {evento.descricao && (
            <p style={{ margin: '0.45rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{evento.descricao}</p>
          )}
        </div>

        {/* Ações: detalhe para todos; editar/excluir só para quem tem permissão */}
        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
          <button onClick={() => { setEventoVisualizar(evento); setModalVisualizacao(true); }} title="Ver detalhes" aria-label="Ver detalhes"
            style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.12)', cursor: 'pointer', fontSize: '0.9rem' }}>👁️</button>
          {podeEditar && (
            <>
              <button onClick={() => editarEvento(evento)} title="Editar" aria-label="Editar"
                style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-accent)', background: 'var(--color-accent-bg)', cursor: 'pointer', fontSize: '0.9rem' }}>✏️</button>
              <button onClick={() => excluirEvento(evento.id)} title="Excluir" aria-label="Excluir"
                style={{ width: '2rem', height: '2rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.12)', cursor: 'pointer', fontSize: '0.9rem' }}>🗑️</button>
            </>
          )}
        </div>
      </div>
    );
  };

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

  const formatarDataCompleta = (data) => {
    if (!data) return '';
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const [ano, mes, dia] = data.split('-').map(n => parseInt(n, 10));
    const dataObj = new Date(ano, mes - 1, dia);
    return `${diasSemana[dataObj.getDay()]}, ${dia} de ${meses[mes - 1]} de ${ano}`;
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

  // ─── Estilos padronizados da barra de filtros/ações ───────────────────────
  // Mesma altura, raio de borda e fonte para TODOS os botões e campos da barra
  const estiloCampoFiltro = {
    width: '100%',
    height: '2.5rem',
    padding: '0 0.75rem',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    fontSize: '0.875rem'
  };

  const estiloBotaoBase = {
    height: '2.5rem',
    padding: '0 1.1rem',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid transparent',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.15s ease'
  };

  const estiloBotaoOutline = {
    ...estiloBotaoBase,
    background: 'var(--color-surface-2)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)'
  };

  const estiloBotaoAtivo = {
    ...estiloBotaoBase,
    background: 'var(--color-accent)',
    color: '#fff'
  };

  if (loading) {
    return <div className="text-center py-12">Carregando cronograma...</div>;
  }

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>📅 Cronograma{anoExibido ? ` ${anoExibido}` : ''}</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
            {anoExibido === 0 ? 'Todos os anos — eventos, sessões e atividades da Loja' : 'Eventos, sessões e atividades da Loja'}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
          <select
            value={anoExibido}
            onChange={(e) => { setAnoFiltro(parseInt(e.target.value)); setFiltroMes(''); }}
            aria-label="Ano"
            style={{ height: '2.6rem', padding: '0 0.9rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano} ({qtdPorAno[ano]})</option>)}
            <option value={0}>Todos ({eventos.length})</option>
          </select>
          <button
            onClick={() => { setTipoRelatorio('mensal'); setRelatorioForm(f => ({ ...f, ano: anoExibido || anoAtual })); setMostrarModalRelatorio(true); }}
            style={{ ...btnBaseTela, background: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}
            title="Gerar relatório em PDF (mensal, semestral ou anual)"
          >
            📄 Relatório
          </button>
          {podeEditar && (
            <button
              onClick={() => { limparFormulario(); setMostrarFormulario(true); }}
              style={{ ...btnBaseTela, background: 'var(--color-accent)', color: '#fff', border: 'none' }}
            >
              ➕ Novo Evento
            </button>
          )}
        </div>
      </div>

      {/* Aviso: ano atual sem eventos no cronograma */}
      {!anoAtualTemEvento && (
        <div style={{ padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.45)', borderLeft: '4px solid #f59e0b', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div>
            <strong style={{ color: '#f59e0b', fontSize: '0.9rem' }}>⚠️ Ainda não há eventos no cronograma de {anoAtual}</strong>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text)' }}>
              {anoExibido !== 0 ? `Estão sendo exibidos os eventos de ${anoExibido}. ` : ''}Cadastre o cronograma do ano.
            </p>
          </div>
          {podeEditar && (
            <button onClick={() => { limparFormulario(); setMostrarFormulario(true); }}
              style={{ height: '2.2rem', padding: '0 1rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              ➕ Cadastrar evento de {anoAtual}
            </button>
          )}
        </div>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div style={cartaoKpi('var(--color-accent)')}>
          <p style={rotuloKpi}>Eventos {anoExibido === 0 ? '(todos)' : `em ${anoExibido}`}</p>
          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{eventosDoAno.length}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {statusEvento.filter(st => contagemStatus[st.value] > 0).map(st => (
              <span key={st.value} style={chip}>{st.label.replace(/^\S+\s/, '')} <strong style={{ color: 'var(--color-text)' }}>{contagemStatus[st.value]}</strong></span>
            ))}
            {qtdFeriados > 0 && <span style={chip}>🎌 Feriados <strong style={{ color: 'var(--color-text)' }}>{qtdFeriados}</strong></span>}
          </div>
        </div>

        <div style={cartaoKpi('#f59e0b')}>
          <p style={rotuloKpi}>Próximo evento</p>
          {proximoEvento ? (
            <>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2 }}>{formatarData(proximoEvento.data_evento)}</p>
              <p style={{ margin: '0.15rem 0 0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {DIAS_COMPLETOS[new Date(proximoEvento.data_evento + 'T00:00:00').getDay()]} · {relativo(proximoEvento.data_evento)}
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={proximoEvento.titulo}>
                {obterIconeTipo(proximoEvento.tipo)} {proximoEvento.titulo}
              </p>
            </>
          ) : (
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Nenhum evento futuro</p>
          )}
        </div>

        <div style={cartaoKpi('#3b82f6')}>
          <p style={rotuloKpi}>Sessões {anoExibido === 0 ? '' : `em ${anoExibido}`}</p>
          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>{sessoesDoAno.length}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            <span style={chip}>🎯 Realizadas <strong style={{ color: 'var(--color-text)' }}>{sessoesRealizadas}</strong></span>
            <span style={chip}>📋 Previstas <strong style={{ color: 'var(--color-text)' }}>{sessoesDoAno.length - sessoesRealizadas}</strong></span>
          </div>
        </div>

        <div style={cartaoKpi(pendencias.length > 0 ? '#ef4444' : '#10b981')}>
          <p style={rotuloKpi}>Pendências</p>
          {pendencias.length === 0 ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#10b981' }}>✅ Tudo em dia</p>
          ) : (
            <>
              <p style={{ margin: '0.25rem 0 0.2rem', fontSize: '2rem', fontWeight: 800, color: '#ef4444', lineHeight: 1.1 }}>{pendencias.length}</p>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>já passaram e seguem como Planejado/Confirmado</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {pendencias.slice(0, 3).map(ev => (
                  <button key={ev.id} onClick={() => podeEditar && editarEvento(ev)} disabled={!podeEditar} title={podeEditar ? 'Abrir para atualizar a situação' : ev.titulo}
                    style={{ ...chip, cursor: podeEditar ? 'pointer' : 'default', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatarData(ev.data_evento).slice(0, 5)} · {ev.titulo}
                  </button>
                ))}
                {pendencias.length > 3 && <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>+{pendencias.length - 3}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Cadastro/Edição de Evento */}
      {mostrarFormulario && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={limparFormulario}
        >
          <div
            key={eventoEditando?.id || 'novo'}
            className="rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",boxShadow:"var(--shadow-xl)"}}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 rounded-t-xl text-white" style={{background:"var(--color-accent)"}}>
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>
                  {eventoEditando ? '✏️ Editar Evento' : '➕ Cadastrar Novo Evento'}
                </h3>
                <button
                  onClick={limparFormulario}
                  style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1rem",fontWeight:"700"}}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6" style={{background:"var(--color-surface)"}}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      cor_destaque: tipo ? tipo.cor : '#3b82f6',
                      // feriado: sem situação a acompanhar (fica "confirmado" por trás)
                      ...(e.target.value === 'feriado' ? { status: 'confirmado' } : (eventoForm.tipo === 'feriado' ? { status: 'planejado' } : {}))
                    });
                  }}
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                >
                  {tiposEvento.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>

              {eventoForm.tipo === 'feriado' ? (
                <div className="md:col-span-2" style={{padding:'0.7rem 0.9rem',borderRadius:'var(--radius-md)',background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.35)',fontSize:'0.82rem',color:'var(--color-text)'}}>
                  🎌 <strong>Feriado</strong> é só informativo: não tem grau nem situação a acompanhar e não entra nas pendências.
                </div>
              ) : (
                <>
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
                  <option value={5}>📋 Sessão Administrativa (Todos)</option>
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

                </>
              )}

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
                  rows={6}
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
                  rows={3}
                  placeholder="Observações adicionais"
                  className="w-full px-3 py-2 border rounded" style={{background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
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
          </div>
        </div>
      )}

      {/* Filtros e Visualização */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '0.9rem 1rem' }}>
        {visualizacao === 'lista' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.8rem' }}>
            {[['', 'Todos', eventosPorTipo.length], ...MESES_ABREV.map((m, i) => [String(i + 1).padStart(2, '0'), m, qtdPorMes[String(i + 1).padStart(2, '0')] || 0])].map(([valor, rotulo, qtd]) => {
              const ativo = filtroMes === valor;
              const ehMesAtual = anoExibido === anoAtual && valor !== '' && `${anoAtual}-${valor}` === mesAtualKey;
              return (
                <button key={valor || 'todos'} onClick={() => setFiltroMes(valor)}
                  style={{ height: '2.1rem', padding: '0 0.8rem', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                    border: `1px solid ${ativo ? 'var(--color-accent)' : ehMesAtual ? 'var(--color-accent)' : 'var(--color-border-light)'}`,
                    background: ativo ? 'var(--color-accent)' : 'var(--color-bg)',
                    color: ativo ? '#fff' : qtd === 0 ? 'var(--color-text-muted)' : 'var(--color-text)',
                    opacity: qtd === 0 && !ativo ? 0.55 : 1 }}>
                  {rotulo}{qtd > 0 && <span style={{ marginLeft: '0.35rem', opacity: 0.85, fontWeight: 600 }}>{qtd}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            aria-label="Tipo de evento"
            style={{ height: '2.3rem', padding: '0 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', minWidth: '12rem' }}
          >
            <option value="">Todos os tipos</option>
            {tiposEvento.map(tipo => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
          </select>
          {filtrosAtivos && (
            <button onClick={() => { setFiltroTipo(''); setFiltroMes(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
              Limpar filtros
            </button>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <strong style={{ color: 'var(--color-text)' }}>{totalMostrado}</strong> evento(s)
          </span>

          <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.25rem', padding: '0.25rem', background: 'var(--color-bg)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-lg)' }}>
            {[['lista', '📋 Lista'], ['calendario', '📅 Calendário']].map(([valor, rotulo]) => (
              <button key={valor} onClick={() => setVisualizacao(valor)}
                style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                  background: visualizacao === valor ? 'var(--color-accent)' : 'transparent', color: visualizacao === valor ? '#fff' : 'var(--color-text-muted)' }}>
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL DE RELATÓRIO */}
      {mostrarModalRelatorio && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-md w-full p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <h3 className="text-xl font-bold mb-4" style={{color:"var(--color-text)"}}>📄 Gerar Relatório</h3>

            <div style={{display:'flex',gap:'0.25rem',padding:'0.25rem',background:'var(--color-bg)',border:'1px solid var(--color-border-light)',borderRadius:'var(--radius-lg)',marginBottom:'1rem'}}>
              {[['mensal','Mensal'],['semestral','Semestral'],['anual','Anual']].map(([valor, rotulo]) => (
                <button key={valor} onClick={() => setTipoRelatorio(valor)}
                  style={{flex:1,padding:'0.45rem 0.5rem',borderRadius:'var(--radius-md)',border:'none',cursor:'pointer',fontSize:'0.85rem',fontWeight:700,
                    background: tipoRelatorio === valor ? 'var(--color-accent)' : 'transparent', color: tipoRelatorio === valor ? '#fff' : 'var(--color-text-muted)'}}>
                  {rotulo}
                </button>
              ))}
            </div>

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
        <div className="space-y-4">
          {Object.entries(agruparPorMes(eventosFiltrados)).map(([mes, eventosDoMes]) => {
            const passado = mes < mesAtualKey;
            return (
              <div key={mes} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleMes(mes)}
                  style={{ padding: '0.7rem 1.1rem', background: 'var(--color-surface-2)', borderLeft: `4px solid ${passado ? 'var(--color-border-light)' : 'var(--color-accent)'}`, borderBottom: isMesAberto(mes) ? '1px solid var(--color-border)' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: passado ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
                      📆 {formatarMesAno(mes)}
                      {passado && <span style={{ fontSize: '0.7rem', marginLeft: '0.5rem', fontWeight: 600, opacity: 0.8 }}>(passado)</span>}
                    </h3>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{eventosDoMes.length} evento(s)</p>
                  </div>
                  <span style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', display: 'inline-block', transition: 'transform 0.2s', transform: isMesAberto(mes) ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
                </div>
                {isMesAberto(mes) && <div>{eventosDoMes.map(renderEvento)}</div>}
              </div>
            );
          })}

          {eventosFiltrados.length === 0 && (
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '3rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>📅</p>
              <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text)' }}>{eventos.length === 0 ? 'Nenhum evento cadastrado' : 'Nenhum evento com esses filtros'}</p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem' }}>
                {eventos.length === 0 && podeEditar ? 'Clique em "Novo Evento" para começar' : anoExibido !== 0 ? `em ${anoExibido}` : ''}
              </p>
              {filtrosAtivos && (
                <button onClick={() => { setFiltroTipo(''); setFiltroMes(''); }}
                  style={{ marginTop: '0.9rem', height: '2.2rem', padding: '0 1rem', background: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <CalendarioAnual key={anoCalendario} eventos={eventosCalendario} ano={anoCalendario} />
      )}

      {/* Modal de Visualização */}
      {modalVisualizacao && eventoVisualizar && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{background:'rgba(0,0,0,0.55)'}}
          onClick={() => setModalVisualizacao(false)}
        >
          {/* Moldura cinza — só um pouco maior que o quadro (não tela toda) */}
          <div
            className="relative"
            style={{background:'#e5e7eb',borderRadius:'0.75rem',padding:'2cm',boxShadow:'0 10px 40px rgba(0,0,0,0.35)',maxHeight:'92vh',overflowY:'auto'}}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalVisualizacao(false)}
              style={{position:'absolute',top:'0.6cm',right:'0.6cm',zIndex:10,background:'#1a2138',border:'2px solid #c9a84c',color:'#c9a84c',borderRadius:'50%',width:'2.25rem',height:'2.25rem',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'1.1rem',fontWeight:'700',boxShadow:'0 2px 8px rgba(0,0,0,0.25)'}}
            >
              ×
            </button>

            {/* Quadro do evento — moldura dourada pra dentro, intacto */}
            <div 
              id="quadro-evento"
              className="rounded-xl relative overflow-hidden"
              style={{
                width:'32rem',
                maxWidth:'80vw',
                background:'linear-gradient(180deg, #0f1729 0%, #1a2138 100%)',
                border:'3px solid #c9a84c',
                boxShadow:'0 0 0 1px rgba(201,168,76,0.3), var(--shadow-xl)'
              }}
            >
            {/* Sol e Lua no topo */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'1rem 1rem 0'}}>
              <img src={IMG_SOL} alt="" style={{width:'4.5rem',height:'4.5rem',objectFit:'contain',opacity:0.9}} />
              <img src={IMG_LUA} alt="" style={{width:'4rem',height:'4rem',objectFit:'contain',opacity:0.9}} />
            </div>

            {/* Corpo com colunas nas laterais */}
            <div style={{display:'grid',gridTemplateColumns:'72px 1fr 72px',gap:'0.5rem',padding:'0 0.25rem 1rem',alignItems:'stretch'}}>
              {/* Coluna B */}
              <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                <img src={IMG_COLUNA_B} alt="" style={{width:'100%',objectFit:'contain',opacity:0.85}} />
              </div>

              {/* Pergaminho central */}
              <div style={{background:'#f5f0e1',borderRadius:'0.5rem',border:'2px solid #c9a84c',padding:'1.25rem 1rem',boxShadow:'0 4px 12px rgba(0,0,0,0.35)'}}>
                {/* Data/hora */}
                <div style={{textAlign:'center',marginBottom:'0.75rem',fontFamily:'Georgia, serif'}}>
                  <p style={{fontSize:'1rem',fontWeight:'700',color:'#1a1a1a',lineHeight:'1.4',margin:0}}>
                    {formatarDataCompleta(eventoVisualizar.data_evento)}
                  </p>
                  {eventoVisualizar.hora_inicio && (
                    <p style={{fontSize:'0.95rem',fontWeight:'700',color:'#1a1a1a',margin:0}}>
                      Às {formatarHora(eventoVisualizar.hora_inicio)}h
                    </p>
                  )}
                </div>

                <div style={{width:'60%',height:'2px',background:'linear-gradient(90deg,transparent,#c9a84c,transparent)',margin:'0 auto 0.75rem'}}></div>

                {/* Título / tipo + grau */}
                <div style={{textAlign:'center',marginBottom:'0.75rem'}}>
                  <p style={{fontSize:'1.15rem',fontWeight:'800',color:'#1e3a8a',fontFamily:'Georgia, serif',margin:0,lineHeight:'1.3'}}>
                    {tiposEvento.find(t => t.value === eventoVisualizar.tipo)?.label.replace(/^[^\s]+\s/, '') || eventoVisualizar.titulo}
                  </p>
                  {eventoVisualizar.tipo !== 'feriado' && eventoVisualizar.grau_sessao_id && (
                    <p style={{fontSize:'1.05rem',fontWeight:'800',color:'#1a1a1a',textTransform:'uppercase',letterSpacing:'0.02em',margin:'0.15rem 0 0'}}>
                      {getGrauNome(eventoVisualizar.grau_sessao_id).replace(/^[^\s]+\s/, '')}
                    </p>
                  )}
                  {eventoVisualizar.titulo && (
                    <p style={{fontSize:'0.85rem',color:'#444',margin:'0.25rem 0 0'}}>{eventoVisualizar.titulo}</p>
                  )}
                </div>

                {/* Ordem do Dia (usa a Descrição já existente) */}
                {eventoVisualizar.descricao && (
                  <div style={{marginBottom:'0.75rem'}}>
                    <p style={{fontSize:'0.8rem',fontWeight:'800',color:'#b8860b',marginBottom:'0.25rem'}}>Ordem do Dia:</p>
                    <p style={{fontSize:'0.82rem',color:'#1a1a1a',whiteSpace:'pre-wrap',lineHeight:'1.5',margin:0}}>
                      {eventoVisualizar.descricao}
                    </p>
                  </div>
                )}

                {/* Local / Responsável */}
                {(eventoVisualizar.local || eventoVisualizar.responsavel) && (
                  <div style={{fontSize:'0.78rem',color:'#333',marginBottom:'0.5rem'}}>
                    {eventoVisualizar.local && <p style={{margin:'0.1rem 0'}}>📍 {eventoVisualizar.local}</p>}
                    {eventoVisualizar.responsavel && <p style={{margin:'0.1rem 0'}}>👤 {eventoVisualizar.responsavel}</p>}
                  </div>
                )}

                {/* Observações (texto solto, sem tratamento especial) */}
                {eventoVisualizar.observacoes && (
                  <p style={{fontSize:'0.82rem',fontWeight:'700',color:'#1a1a1a',whiteSpace:'pre-wrap',textAlign:'center',margin:'0.5rem 0 0'}}>
                    {eventoVisualizar.observacoes}
                  </p>
                )}

                {/* Logo da Loja */}
                {dadosLoja.logo_url && (
                  <div style={{textAlign:'center',marginTop:'1rem'}}>
                    <img src={dadosLoja.logo_url} alt={dadosLoja.nome_loja} style={{width:'3.5rem',height:'3.5rem',objectFit:'contain',margin:'0 auto'}} />
                    <p style={{fontSize:'0.6rem',color:'#666',marginTop:'0.25rem'}}>{dadosLoja.nome_loja}</p>
                  </div>
                )}
              </div>

              {/* Coluna J */}
              <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
                <img src={IMG_COLUNA_J} alt="" style={{width:'100%',objectFit:'contain',opacity:0.85}} />
              </div>
            </div>

            {/* Status (mantido do modal original) — feriado não tem situação */}
            {eventoVisualizar.tipo !== 'feriado' && <div style={{padding:'0 1rem 1rem',textAlign:'center'}}>
              <span 
                className="inline-block px-3 py-1 rounded-full text-xs font-medium"
                style={statusEvento.find(s => s.value === eventoVisualizar.status)?.style || {}}
              >
                {statusEvento.find(s => s.value === eventoVisualizar.status)?.label || eventoVisualizar.status}
              </span>
            </div>}
            </div>{/* fim #quadro-evento */}
          </div>
        </div>
      )}
    </div>
  );
}
