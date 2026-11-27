import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { ESTADOS_CIVIS, rotuloEstadoCivilCompleto, uniaoEstavelPendente } from '../../utils/constants';
import CampoUniaoEstavel from './CampoUniaoEstavel';
import VidaMaconica from '../vida-maconica/VidaMaconica';
import GestaoSituacoes from './GestaoSituacoes';
import InstrucoesTrabalhos from './InstrucoesTrabalhos';
import QuadrosComendas from './QuadrosComendas';
import { gerarRelatorioIndividualPDF } from '../../utils/gerarRelatorioIndividualPDF';

export default function PerfilIrmao({ irmaoId, onVoltar, showSuccess, showError, permissoes, userEmail, userData }) {
  const boxCard = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "1.25rem" };
  const boxTitle = { fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text)", marginBottom: "1rem", paddingBottom: "0.6rem", borderBottom: "1px solid var(--color-border)" };
  // Campo em edição e campo em visualização com o mesmo "corpo" (padrão da tela de Balaústres)
  const campoInput = { width: "100%", padding: "0.6rem 0.75rem", borderRadius: "var(--radius-lg)", background: "var(--color-surface-2)", color: "var(--color-text)", border: "1px solid var(--color-border)" };
  const valorCampo = { width: "100%", minHeight: "2.5rem", padding: "0.6rem 0.75rem", borderRadius: "var(--radius-lg)", background: "var(--color-surface-2)", color: "var(--color-text)", border: "1px solid var(--color-border)", margin: 0, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.35rem", wordBreak: "break-word" };
  const rotuloCampo = { display: "block", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginBottom: "0.25rem" };
  const vazioCampo = { color: "var(--color-text-muted)", opacity: 0.6, fontStyle: "italic", fontWeight: 400 };
  const COR_GRAU_PERFIL = { 'Aprendiz': '#eab308', 'Companheiro': '#10b981', 'Mestre': '#3b82f6', 'Mestre Instalado': '#3b82f6' };
  const [irmao, setIrmao] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [modalRelatorio, setModalRelatorio] = useState(false);
  const [relInicio, setRelInicio] = useState(`${new Date().getFullYear()}-01-01`);
  const [relFim, setRelFim] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState('pessoal');
  const [irmaoForm, setIrmaoForm] = useState({});
  const [familiares, setFamiliares] = useState({
    conjuge: null,
    pais: { pai: null, mae: null },
    filhos: []
  });
  const [historicoCargos, setHistoricoCargos] = useState([]);
  const [filhoEditandoIndex, setFilhoEditandoIndex] = useState(null);
  const [filhoForm, setFilhoForm] = useState({
    nome: '',
    data_nascimento: '',
    sexo: '',
    tipo_vinculo: '',
    vivo: true,
    data_obito: ''
  });

  useEffect(() => {
    if (irmaoId) {
      carregarIrmao();
      carregarFamiliares();
      carregarHistoricoCargos();
    }
  }, [irmaoId]);


  const carregarIrmao = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('irmaos')
      .select('*')
      .eq('id', irmaoId)
      .single();

    if (data) {
      setIrmao(data);
      setIrmaoForm(data);
    }
    setLoading(false);
  };

  const carregarFamiliares = async () => {
    // Carregar cônjuge
    const { data: conjugeData } = await supabase
      .from('esposas')
      .select('*')
      .eq('irmao_id', irmaoId)
      .single();

    // Carregar pais
    const { data: paisData } = await supabase
      .from('pais')
      .select('*')
      .eq('irmao_id', irmaoId);

    const pai = paisData?.find(p => p.tipo === 'pai');
    const mae = paisData?.find(p => p.tipo === 'mae');

    // Carregar filhos
    const { data: filhosData } = await supabase
      .from('filhos')
      .select('*')
      .eq('irmao_id', irmaoId)
      .order('data_nascimento', { ascending: true });

    setFamiliares({
      conjuge: conjugeData || null,
      pais: { pai: pai || null, mae: mae || null },
      filhos: filhosData || []
    });
  };

  const carregarHistoricoCargos = async () => {
    try {
      console.log('🔍 Carregando cargos para irmão ID:', irmaoId);
      const { data: cargosData, error } = await supabase
        .from('historico_cargos')
        .select('*')
        .eq('irmao_id', irmaoId)
        .order('ano', { ascending: false });

      console.log('📊 Cargos retornados:', cargosData);
      console.log('❌ Erro (se houver):', error);

      setHistoricoCargos(cargosData || []);
    } catch (error) {
      console.log('ℹ️ Erro ao carregar cargos:', error.message);
      setHistoricoCargos([]);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!irmaoForm.estado_civil) {
      showError('❌ Informe o estado civil (campo obrigatório).');
      return;
    }
    if (uniaoEstavelPendente(irmaoForm.estado_civil, irmaoForm.uniao_estavel)) {
      showError('❌ Informe se o irmão mantém ou não união estável (campo obrigatório).');
      return;
    }
    try {
      // Salvar dados básicos do irmão (casado: união estável não se aplica)
      const { error: erroIrmao } = await supabase
        .from('irmaos')
        .update({ ...irmaoForm, uniao_estavel: irmaoForm.estado_civil === 'casado' ? null : irmaoForm.uniao_estavel })
        .eq('id', irmaoId);

      if (erroIrmao) throw erroIrmao;

      // Salvar cônjuge
      if (familiares.conjuge?.nome) {
        const { data: conjExiste } = await supabase.from('esposas').select('id').eq('irmao_id', irmaoId).maybeSingle();
        if (conjExiste) {
          await supabase.from('esposas').update({
            nome: familiares.conjuge.nome,
            data_nascimento: familiares.conjuge.data_nascimento,
            data_casamento: familiares.conjuge.data_casamento,
            profissao: familiares.conjuge.profissao,
            email: familiares.conjuge.email || null
          }).eq('irmao_id', irmaoId);
        } else {
          await supabase.from('esposas').insert({
            irmao_id: irmaoId, nome: familiares.conjuge.nome,
            data_nascimento: familiares.conjuge.data_nascimento,
            data_casamento: familiares.conjuge.data_casamento,
            profissao: familiares.conjuge.profissao,
            email: familiares.conjuge.email || null
          });
        }
      }

      // Salvar pais (um registro por pai/mãe)
      if (familiares.pais.pai?.nome) {
        const { data: paiExiste } = await supabase.from('pais').select('id').eq('irmao_id', irmaoId).eq('tipo', 'pai').maybeSingle();
        if (paiExiste) {
          await supabase.from('pais').update({
            nome: familiares.pais.pai.nome,
            data_nascimento: familiares.pais.pai.data_nascimento,
            falecido: familiares.pais.pai.falecido || false,
            data_obito: familiares.pais.pai.data_obito || null
          }).eq('id', paiExiste.id);
        } else {
          await supabase.from('pais').insert({
            irmao_id: irmaoId, tipo: 'pai',
            nome: familiares.pais.pai.nome,
            data_nascimento: familiares.pais.pai.data_nascimento,
            falecido: familiares.pais.pai.falecido || false,
            data_obito: familiares.pais.pai.data_obito || null
          });
        }
      }
      
      if (familiares.pais.mae?.nome) {
        const { data: maeExiste } = await supabase.from('pais').select('id').eq('irmao_id', irmaoId).eq('tipo', 'mae').maybeSingle();
        if (maeExiste) {
          await supabase.from('pais').update({
            nome: familiares.pais.mae.nome,
            data_nascimento: familiares.pais.mae.data_nascimento,
            falecido: familiares.pais.mae.falecido || false,
            data_obito: familiares.pais.mae.data_obito || null
          }).eq('id', maeExiste.id);
        } else {
          await supabase.from('pais').insert({
            irmao_id: irmaoId, tipo: 'mae',
            nome: familiares.pais.mae.nome,
            data_nascimento: familiares.pais.mae.data_nascimento,
            falecido: familiares.pais.mae.falecido || false,
            data_obito: familiares.pais.mae.data_obito || null
          });
        }
      }

      // Salvar cargos
      await supabase.from('historico_cargos').delete().eq('irmao_id', irmaoId);
      if (historicoCargos.length > 0) {
        await supabase.from('historico_cargos').insert(
          historicoCargos.map(c => ({ irmao_id: irmaoId, ano: c.ano, cargo: c.cargo }))
        );
      }

      // Salvar filhos - deletar todos e inserir novos
      const { error: deleteError } = await supabase.from('filhos').delete().eq('irmao_id', irmaoId);
      if (deleteError) console.error('Erro ao deletar filhos:', deleteError);
      
      if (familiares.filhos.length > 0) {
        const { error: insertError } = await supabase.from('filhos').insert(
          familiares.filhos.map(f => ({
            irmao_id: irmaoId,
            nome: f.nome,
            data_nascimento: f.data_nascimento || null,
            sexo: f.sexo || 'M',
            tipo_vinculo: f.tipo_vinculo || 'filho',
            vivo: f.vivo !== false,
            data_obito: f.data_obito || null
          }))
        );
        if (insertError) throw insertError;
      }

      showSuccess('✅ Perfil atualizado!');
      setModoEdicao(false);
      carregarIrmao();
      carregarFamiliares();
      carregarHistoricoCargos();
    } catch (error) {
      console.error('Erro:', error);
      showError('❌ Erro: ' + error.message);
    }
  };

  const handleSalvar = async () => {
    // Usar mesma função do botão de cima
    await handleSalvarEdicao();
  };

  const calcularIdade = (dataNascimento) => {
    if (!dataNascimento) return '';
    const hoje = new Date();
    const nascimento = new Date(dataNascimento + 'T00:00:00');
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return `${idade} anos`;
  };

  const calcularTempoMaconaria = (dataIniciacao) => {
    if (!dataIniciacao) return '';
    const inicio = new Date(dataIniciacao + 'T00:00:00');
    const hoje = new Date();
    let anos = hoje.getFullYear() - inicio.getFullYear();
    let meses = hoje.getMonth() - inicio.getMonth();
    if (meses < 0) { anos--; meses = 12 + meses; }
    return `${anos} ano(s) e ${meses} mês(es)`;
  };

  const handleUploadFoto = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      showError('❌ Apenas imagens são permitidas');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('❌ Imagem muito grande. Máximo 5MB');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${irmaoId}_${Date.now()}.${fileExt}`;
      const filePath = `fotos_irmaos/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('loja-acacia')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('loja-acacia')
        .getPublicUrl(filePath);

      // Atualizar no banco
      const { error: updateError } = await supabase
        .from('irmaos')
        .update({ foto_url: publicUrl })
        .eq('id', irmaoId);

      if (updateError) throw updateError;

      showSuccess('✅ Foto atualizada com sucesso!');
      carregarIrmao();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showError('❌ Erro ao fazer upload: ' + error.message);
    }
  };

  const handleUploadPDF = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo
    if (file.type !== 'application/pdf') {
      showError('❌ Apenas arquivos PDF são permitidos');
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError('❌ Arquivo muito grande. Máximo 10MB');
      return;
    }

    try {
      const fileName = `${irmaoId}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `documentos_irmaos/${fileName}`;

      // Upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('loja-acacia')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('loja-acacia')
        .getPublicUrl(filePath);

      // Salvar na tabela documentos_irmaos
      const { error: insertError } = await supabase
        .from('documentos_irmaos')
        .insert({
          irmao_id: irmaoId,
          nome_arquivo: file.name,
          url_arquivo: publicUrl,
          tipo: 'pdf'
        });

      if (insertError) throw insertError;

      showSuccess('✅ Documento enviado com sucesso!');
      carregarDocumentos();
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      showError('❌ Erro ao fazer upload: ' + error.message);
    }
  };

  const [documentos, setDocumentos] = useState([]);

  const carregarDocumentos = async () => {
    const { data } = await supabase
      .from('documentos_irmaos')
      .select('*')
      .eq('irmao_id', irmaoId)
      .order('created_at', { ascending: false });
    
    setDocumentos(data || []);
  };

  const handleExcluirDocumento = async (docId, urlArquivo) => {
    if (!confirm('Deseja realmente excluir este documento?')) return;

    try {
      // Extrair caminho do arquivo da URL
      const filePath = urlArquivo.split('/').slice(-2).join('/');
      
      // Excluir do storage
      await supabase.storage
        .from('loja-acacia')
        .remove([filePath]);

      // Excluir do banco
      const { error } = await supabase
        .from('documentos_irmaos')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      showSuccess('✅ Documento excluído com sucesso!');
      carregarDocumentos();
    } catch (error) {
      showError('❌ Erro ao excluir documento: ' + error.message);
    }
  };

  useEffect(() => {
    if (irmaoId && abaSelecionada === 'documentos') {
      carregarDocumentos();
    }
  }, [irmaoId, abaSelecionada]);


  // ── Derivados para o cabeçalho ──
  const dataLocalPerfil = (d) => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00') : null);
  const fmtDataPerfil = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
  const mesesEntre = (a, b) => {
    const i = dataLocalPerfil(a); const f = b ? dataLocalPerfil(b) : new Date();
    if (!i || !f) return null;
    let m = (f.getFullYear() - i.getFullYear()) * 12 + (f.getMonth() - i.getMonth());
    if (f.getDate() < i.getDate()) m--;
    return Math.max(m, 0);
  };
  const fmtMeses = (m) => (m == null ? '' : m < 1 ? 'menos de 1 mês' : `${Math.floor(m / 12) ? Math.floor(m / 12) + 'a ' : ''}${m % 12}m`.trim());
  const grauAtualPerfil = irmao ? (irmao.data_exaltacao ? (irmao.mestre_instalado ? 'Mestre Instalado' : 'Mestre') : irmao.data_elevacao ? 'Companheiro' : irmao.data_iniciacao ? 'Aprendiz' : 'Não iniciado') : '';
  const corGrauPerfil = COR_GRAU_PERFIL[grauAtualPerfil] || '#94a3b8';
  const idadePerfil = irmao?.data_nascimento ? parseInt(calcularIdade(irmao.data_nascimento), 10) : null;
  const pendenciasPerfil = irmao ? [
    !irmao.estado_civil && 'Estado civil',
    irmao.estado_civil && uniaoEstavelPendente(irmao.estado_civil, irmao.uniao_estavel) && 'União estável',
    !irmao.cpf && 'CPF',
    !irmao.data_nascimento && 'Data de nascimento',
    !irmao.telefone && 'Telefone',
    !irmao.email && 'E-mail',
  ].filter(Boolean) : [];
  const situacaoPerfil = (irmao?.situacao || 'regular');
  const COR_SIT_PERFIL = { regular: '#10b981', licenciado: '#eab308', irregular: '#f97316', suspenso: '#ef4444', excluido: '#ef4444', falecido: '#64748b', desligado: '#94a3b8', ex_oficio: '#8b5cf6' };
  const corSitPerfil = COR_SIT_PERFIL[String(situacaoPerfil).toLowerCase().replace(/[-\s]/g, '_')] || '#64748b';
  const chipPerfil = (texto, cor) => (
    <span style={{ display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: cor + '26', color: cor, border: `1px solid ${cor}`, whiteSpace: 'nowrap' }}>{texto}</span>
  );

  const gerarRelatorioPresenca = async () => {
    setGerandoRelatorio(true);
    try {
      const { data: sessoesPeriodo } = await supabase
        .from('sessoes_presenca')
        .select('id, data_sessao, grau_sessao_id, graus_sessao:grau_sessao_id(nome), classificacoes_sessao:classificacao_id(nome)')
        .gte('data_sessao', relInicio).lte('data_sessao', relFim).order('data_sessao');
      const ids = (sessoesPeriodo || []).map(x => x.id);
      let registros = [];
      if (ids.length > 0) {
        let ini = 0; let continuar = true;
        while (continuar) {
          const { data: lote } = await supabase.from('registros_presenca')
            .select('membro_id, sessao_id, presente, justificativa')
            .eq('membro_id', irmaoId).in('sessao_id', ids).range(ini, ini + 999);
          if (lote && lote.length > 0) { registros = [...registros, ...lote]; ini += 1000; if (lote.length < 1000) continuar = false; } else continuar = false;
        }
      }
      const grade = {};
      registros.forEach(r => { if (!grade[r.membro_id]) grade[r.membro_id] = {}; grade[r.membro_id][r.sessao_id] = { presente: r.presente, justificativa: r.justificativa }; });
      const { data: hist } = await supabase.from('historico_situacoes').select('*').in('status', ['ativa', 'vencida']);
      const { data: loja } = await supabase.from('dados_loja').select('*').limit(1).maybeSingle();
      const irmaoRel = { ...irmao, idade: idadePerfil, data_prerrogativa: null };
      if (idadePerfil != null && idadePerfil >= 70) {
        const nasc = dataLocalPerfil(irmao.data_nascimento);
        nasc.setFullYear(nasc.getFullYear() + 70);
        irmaoRel.data_prerrogativa = nasc;
      }
      gerarRelatorioIndividualPDF(irmaoRel, sessoesPeriodo || [], grade, hist || [], loja, relInicio, relFim);
      setModalRelatorio(false);
    } catch (e) {
      console.error('Erro ao gerar relatório individual:', e);
      if (showError) showError('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setGerandoRelatorio(false);
    }
  };

  useEffect(() => {
    if (!modalRelatorio) return;
    const esc = (e) => { if (e.key === 'Escape') setModalRelatorio(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [modalRelatorio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Carregando perfil...</div>
      </div>
    );
  }

  if (!irmao) {
    return (
      <div className="text-center py-12">
        <p>Irmão não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.5rem",overflowX:"hidden"}}>
      {/* Cartão de identificação */}
      <div style={{background:"var(--color-surface)",border:"1px solid var(--color-border)",borderTop:`5px solid ${corGrauPerfil}`,borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
        <div style={{padding:"1.25rem 1.5rem",display:"flex",flexWrap:"wrap",gap:"1.25rem",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:"1.25rem",alignItems:"center",minWidth:0,flexWrap:"wrap"}}>
            <div style={{position:"relative",flexShrink:0}}>
              {irmao.foto_url ? (
                <img src={irmao.foto_url} alt={irmao.nome}
                  style={{width:112,height:112,borderRadius:"50%",objectFit:"cover",border:`4px solid ${corGrauPerfil}`,display:"block"}} />
              ) : (
                <div style={{width:112,height:112,borderRadius:"50%",border:`4px solid ${corGrauPerfil}`,background:corGrauPerfil+"26",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.4rem",fontWeight:800,color:corGrauPerfil}}>
                  {(irmao.nome || '?').trim().split(/\s+/).filter(Boolean).map((p,i,a)=> (i===0||i===a.length-1)?p[0]:'').join('').toUpperCase()}
                </div>
              )}
              {(permissoes?.pode_editar_irmaos || userEmail === irmao.email) && (
                <label title="Alterar foto" style={{position:"absolute",right:-2,bottom:-2,width:34,height:34,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--color-accent)",color:"#fff",border:"3px solid var(--color-surface)",fontSize:"0.95rem"}}>
                  📷
                  <input type="file" accept="image/*" onChange={handleUploadFoto} style={{display:"none"}} />
                </label>
              )}
            </div>

            <div style={{minWidth:0}}>
              <h1 style={{margin:0,fontSize:"1.75rem",fontWeight:800,color:"var(--color-text)",lineHeight:1.2}}>{irmao.nome}</h1>
              <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem",marginTop:"0.6rem",alignItems:"center"}}>
                {chipPerfil(grauAtualPerfil, corGrauPerfil)}
                {chipPerfil(String(situacaoPerfil).charAt(0).toUpperCase() + String(situacaoPerfil).slice(1), corSitPerfil)}
                {irmao.status && irmao.status !== 'ativo' && chipPerfil(irmao.status.toUpperCase(), '#64748b')}
                {idadePerfil != null && idadePerfil >= 70 && chipPerfil('Prerrogativa 70+', '#f59e0b')}
                {pendenciasPerfil.length > 0 && (
                  <span title={'Dados pendentes: ' + pendenciasPerfil.join(', ')}
                    style={{fontSize:"0.72rem",fontWeight:700,color:"#f59e0b",cursor:"help"}}>
                    ⚠ {pendenciasPerfil.length} dado(s) pendente(s)
                  </span>
                )}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"1.25rem",marginTop:"0.75rem",fontSize:"0.82rem",color:"var(--color-text-muted)"}}>
                <span>🪪 CIM <strong style={{color:"var(--color-text)"}}>{irmao.cim || '-'}</strong></span>
                {idadePerfil != null && <span>🎂 <strong style={{color:"var(--color-text)"}}>{idadePerfil} anos</strong></span>}
                {irmao.data_iniciacao && <span>🔨 Iniciado em <strong style={{color:"var(--color-text)"}}>{fmtDataPerfil(irmao.data_iniciacao)}</strong></span>}
                {irmao.data_iniciacao && <span>⏳ <strong style={{color:"var(--color-text)"}}>{fmtMeses(mesesEntre(irmao.data_iniciacao))}</strong> de maçonaria</span>}
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
            {(permissoes?.pode_editar_irmaos || userEmail === irmao.email) && !modoEdicao && (
              <button onClick={() => setModalRelatorio(true)}
                style={{padding:"0.5rem 1rem",background:"#dc2626",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}>
                📄 Relatório de Presença
              </button>
            )}
            {userEmail === irmao.email && !modoEdicao && (
              <button onClick={() => setModoEdicao(true)}
                style={{padding:"0.5rem 1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}>
                ✏️ Editar Meu Perfil
              </button>
            )}
            <button onClick={onVoltar}
              style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}>
              ← Voltar
            </button>
          </div>
        </div>
      </div>

      {modoEdicao && (
        <div style={{padding:"0.75rem 1rem",borderRadius:"var(--radius-lg)",background:"rgba(245,158,11,0.12)",border:"1px solid #f59e0b",color:"var(--color-text)",fontSize:"0.85rem"}}>
          ✏️ <strong>Modo edição:</strong> as alterações só são gravadas ao clicar em <strong>Salvar</strong> (barra no rodapé da tela).
        </div>
      )}

      {/* Abas */}
      <div className="rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div style={{display:"flex",gap:"0.4rem",overflowX:"auto",padding:"0.6rem 0.75rem",borderBottom:"1px solid var(--color-border)"}}>
          {[
            ['pessoal','📋','Dados Pessoais'],
            ['maconico','🔨','Dados Maçônicos'],
            ['familiar','👨‍👩‍👧','Dados Familiares'],
            ['vida-maconica','🔺','Vida Maçônica'],
            ['situacoes','🗓️','Situações'],
            ['documentos','📄','Documentos'],
          ].map(([chave, icone, rotulo]) => {
            const ativa = abaSelecionada === chave;
            return (
              <button key={chave} onClick={() => setAbaSelecionada(chave)}
                style={{padding:"0.5rem 1rem",borderRadius:"999px",fontSize:"0.82rem",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",
                  border:`1px solid ${ativa ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: ativa ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: ativa ? '#fff' : 'var(--color-text-muted)'}}>
                {icone} {rotulo}{chave === 'documentos' && documentos.length > 0 ? ` (${documentos.length})` : ''}
              </button>
            );
          })}
        </div>

        {/* Conteúdo das Abas */}
        <style>{`
          .perfil-dados p { font-size: 0.95rem; font-weight: 600; color: var(--color-text); margin: 0; overflow-wrap: anywhere; }
          .perfil-dados p.text-xs { font-size: 0.75rem; font-weight: 500; color: var(--color-text-muted); margin-top: 2px; }
        `}</style>
        <div className="p-6 perfil-dados">
          {/* ABA: Dados Pessoais */}
          {abaSelecionada === 'pessoal' && (
            <div className="space-y-6">
              {/* Quadro: Identificação */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🪪 Identificação</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Nome Completo */}
                <div className="md:col-span-2">
                  <label style={rotuloCampo}>Nome Completo</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.nome || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, nome: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p className="font-medium" style={valorCampo}>{irmao.nome}</p>
                  )}
                </div>

                {/* CPF */}
                <div>
                  <label style={rotuloCampo}>CPF</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.cpf || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, cpf: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.cpf || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                {/* RG */}
                <div>
                  <label style={rotuloCampo}>RG</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.rg || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, rg: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.rg || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                {/* Data de Nascimento */}
                <div>
                  <label style={rotuloCampo}>Data de Nascimento</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_nascimento || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_nascimento: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <div>
                      <p style={valorCampo}>
                        {irmao.data_nascimento ? irmao.data_nascimento.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                      </p>
                      {irmao.data_nascimento && (
                        <p className="text-xs">{calcularIdade(irmao.data_nascimento)}</p>
                      )}
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Contato */}
              <div style={boxCard}>
                <h4 style={boxTitle}>📞 Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Email */}
                <div>
                  <label style={rotuloCampo}>Email</label>
                  {modoEdicao ? (
                    <input
                      type="email"
                      value={irmaoForm.email || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, email: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.email || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label style={rotuloCampo}>Telefone</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.telefone || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, telefone: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.telefone || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Profissional / Formação */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🎓 Profissional / Formação</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Profissão */}
                <div>
                  <label style={rotuloCampo}>Profissão</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.profissao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, profissao: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.profissao || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                {/* Estado Civil */}
                <div>
                  <label style={rotuloCampo}>Estado Civil</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.estado_civil || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, estado_civil: e.target.value })}
                      style={campoInput}
                    >
                      <option value="">Selecione... *</option>
                      {ESTADOS_CIVIS.map(ec => <option key={ec.value} value={ec.value}>{ec.label}</option>)}
                    </select>
                  ) : (
                    <p style={valorCampo}>{rotuloEstadoCivilCompleto(irmao.estado_civil, irmao.uniao_estavel) || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                  {modoEdicao && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={rotuloCampo}>União Estável *</label>
                      <CampoUniaoEstavel
                        estadoCivil={irmaoForm.estado_civil}
                        valor={irmaoForm.uniao_estavel}
                        onChange={(v) => setIrmaoForm({ ...irmaoForm, uniao_estavel: v })}
                        style={campoInput}
                      />
                    </div>
                  )}
                </div>

                {/* Naturalidade */}
                <div>
                  <label style={rotuloCampo}>Naturalidade</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.naturalidade || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, naturalidade: e.target.value })}
                      placeholder="Ex: Cuiabá/MT"
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.naturalidade || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                {/* Formação */}
                <div>
                  <label style={rotuloCampo}>Formação Acadêmica</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.formacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, formacao: e.target.value })}
                      placeholder="Ex: Bacharel em Direito..."
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.formacao || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                {/* Escolaridade */}
                <div>
                  <label style={rotuloCampo}>Escolaridade</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.escolaridade || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, escolaridade: e.target.value })}
                      style={campoInput}
                    >
                      <option value="fundamental_incompleto">Fundamental Incompleto</option>
                      <option value="fundamental_completo">Fundamental Completo</option>
                      <option value="medio_incompleto">Médio Incompleto</option>
                      <option value="medio_completo">Médio Completo</option>
                      <option value="superior_incompleto">Superior Incompleto</option>
                      <option value="superior_completo">Superior Completo</option>
                      <option value="pos_graduacao">Pós-Graduação</option>
                      <option value="mestrado">Mestrado</option>
                      <option value="doutorado">Doutorado</option>
                    </select>
                  ) : (
                    <p style={valorCampo}>{irmao.escolaridade?.replace(/_/g, ' ') || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Endereço */}
              <div style={boxCard}>
                <h4 style={boxTitle}>📍 Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label style={rotuloCampo}>CEP</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.cep || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, cep: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>{irmao.cep || <span style={vazioCampo}>Não informado</span>}</p>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label style={rotuloCampo}>Logradouro</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.endereco || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, endereco: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>{irmao.endereco || <span style={vazioCampo}>Não informado</span>}</p>
                      )}
                    </div>
                    <div>
                      <label style={rotuloCampo}>Número</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.numero || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, numero: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>{irmao.numero || 'S/N'}</p>
                      )}
                    </div>
                    <div>
                      <label style={rotuloCampo}>Complemento</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.complemento || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, complemento: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>{irmao.complemento || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label style={rotuloCampo}>Bairro</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.bairro || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, bairro: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>{irmao.bairro || <span style={vazioCampo}>Não informado</span>}</p>
                      )}
                    </div>
                    <div>
                      <label style={rotuloCampo}>Cidade</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.cidade || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, cidade: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>{irmao.cidade || <span style={vazioCampo}>Não informado</span>}</p>
                      )}
                    </div>
                    <div>
                      <label style={rotuloCampo}>Estado</label>
                      {modoEdicao ? (
                        <input
                          type="text"
                          value={irmaoForm.estado || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, estado: e.target.value })}
                          maxLength={2}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>{irmao.estado || <span style={vazioCampo}>Não informado</span>}</p>
                      )}
                    </div>
                  </div>
              </div>
            </div>
          )}

          {/* ABA: Dados Maçônicos */}
          {abaSelecionada === 'maconico' && (
            <div className="space-y-6">
              {!modoEdicao && (() => {
                const etapas = [
                  { chave: 'ini', icone: '🔨', rotulo: 'Iniciação', data: irmao.data_iniciacao, cor: COR_GRAU_PERFIL['Aprendiz'] },
                  { chave: 'ele', icone: '📐', rotulo: 'Elevação', data: irmao.data_elevacao, cor: COR_GRAU_PERFIL['Companheiro'] },
                  { chave: 'exa', icone: '⚒️', rotulo: 'Exaltação', data: irmao.data_exaltacao, cor: COR_GRAU_PERFIL['Mestre'] },
                  ...(irmao.mestre_instalado || irmao.data_instalacao ? [{ chave: 'ins', icone: '⭐', rotulo: 'Instalação', data: irmao.data_instalacao, cor: COR_GRAU_PERFIL['Mestre Instalado'] }] : []),
                ];
                return (
                  <div style={boxCard}>
                    <h4 style={boxTitle}>🧭 Linha do Tempo Maçônica</h4>
                    <div style={{display:"grid",gridTemplateColumns:`repeat(${etapas.length}, minmax(140px, 1fr))`,gap:0,overflowX:"auto"}}>
                      {etapas.map((e, idx) => {
                        const feito = !!e.data;
                        const anterior = idx > 0 ? etapas[idx - 1].data : null;
                        const intervalo = feito && anterior ? fmtMeses(mesesEntre(anterior, e.data)) : '';
                        return (
                          <div key={e.chave} style={{textAlign:"center",position:"relative"}}>
                            <div style={{display:"flex",alignItems:"center"}}>
                              <div style={{flex:1,height:3,background: idx === 0 ? 'transparent' : (feito ? e.cor : 'var(--color-border)')}} />
                              <div style={{width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",
                                background: feito ? e.cor + '26' : 'var(--color-surface)', border:`3px solid ${feito ? e.cor : 'var(--color-border)'}`, opacity: feito ? 1 : 0.55}}>{e.icone}</div>
                              <div style={{flex:1,height:3,background: idx === etapas.length - 1 ? 'transparent' : (etapas[idx + 1].data && feito ? etapas[idx + 1].cor : 'var(--color-border)')}} />
                            </div>
                            <div style={{marginTop:"0.5rem",fontWeight:700,fontSize:"0.85rem",color:"var(--color-text)"}}>{e.rotulo}</div>
                            <div style={{fontSize:"0.82rem",color: feito ? 'var(--color-text)' : 'var(--color-text-muted)'}}>{feito ? fmtDataPerfil(e.data) : 'Pendente'}</div>
                            {intervalo && <div style={{fontSize:"0.7rem",color:"var(--color-text-muted)"}}>após {intervalo}</div>}
                          </div>
                        );
                      })}
                    </div>
                    {irmao.data_iniciacao && (
                      <div style={{marginTop:"1rem",paddingTop:"0.75rem",borderTop:"1px solid var(--color-border)",fontSize:"0.8rem",color:"var(--color-text-muted)",textAlign:"center"}}>
                        Tempo total de maçonaria: <strong style={{color:"var(--color-text)"}}>{fmtMeses(mesesEntre(irmao.data_iniciacao))}</strong>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Quadro: CIM e Situação */}
              <div style={boxCard}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label style={rotuloCampo}>CIM</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.cim || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, cim: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p className="font-medium text-lg" style={valorCampo}>{irmao.cim || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                <div>
                  <label style={rotuloCampo}>Situação</label>
                  {modoEdicao ? (
                    <select
                      value={irmaoForm.situacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, situacao: e.target.value })}
                      style={campoInput}
                    >
                      <option value="regular">Regular</option>
                      <option value="irregular">Irregular</option>
                      <option value="licenciado">Licenciado</option>
                      <option value="suspenso">Suspenso</option>
                      <option value="desligado">Quite Placet</option>
                      <option value="excluido">Excluído</option>
                      <option value="falecido">Falecido</option>
                      <option value="ex_oficio">Ex-Ofício</option>
                    </select>
                  ) : (
                    <p className="capitalize text-lg" style={valorCampo}>{irmao.situacao || 'Regular'}</p>
                  )}
                </div>
                </div>
              </div>

              {/* CAMPOS DE DATAS CONDICIONAIS - Aparecem conforme a situação */}
              <div className="border-l-4 p-4 rounded-lg" style={{background:"rgba(245,158,11,0.08)",borderLeftColor:"#f59e0b",border:"1px solid rgba(245,158,11,0.2)"}}>
                <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2" style={{color:"var(--color-text)"}}>
                  <span>📅</span> Datas Específicas da Situação
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CAMPOS DESATIVADOS - Agora usam histórico de situações
                  
                  {/* Data de Licença */}
                  {/* {(modoEdicao ? irmaoForm.situacao === 'licenciado' : irmao.situacao === 'licenciado') && (
                    <div>
                      <label style={rotuloCampo}>
                        Data de Início da Licença
                        {modoEdicao && (
                          <span className="block text-xs font-normal mt-0.5">
                            A partir desta data, será considerado licenciado
                          </span>
                        )}
                      </label>
                      {modoEdicao ? (
                        <input
                          type="date"
                          value={irmaoForm.data_licenca || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, data_licenca: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>
                          {irmao.data_licenca ? irmao.data_licenca.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                        </p>
                      )}
                    </div>
                  )} */}

                  {/* Data de Desligamento - para Desligado e Ex-Ofício */}
                  {/* {(modoEdicao 
                    ? (irmaoForm.situacao === 'desligado' || irmaoForm.situacao === 'ex_oficio')
                    : (irmao.situacao === 'desligado' || irmao.situacao === 'ex_oficio')
                  ) && (
                    <div>
                      <label style={rotuloCampo}>
                        Data do Desligamento
                        {modoEdicao && (
                          <span className="block text-xs font-normal mt-0.5">
                            {(modoEdicao ? irmaoForm.situacao : irmao.situacao) === 'ex_oficio' 
                              ? 'Data do desligamento forçado (Ex-Ofício)'
                              : 'A partir desta data, será considerado desligado'}
                          </span>
                        )}
                      </label>
                      {modoEdicao ? (
                        <input
                          type="date"
                          value={irmaoForm.data_desligamento || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, data_desligamento: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>
                          {irmao.data_desligamento ? irmao.data_desligamento.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                        </p>
                      )}
                    </div>
                  )} */}

                  {/* Data de Falecimento */}
                  {(modoEdicao ? irmaoForm.situacao === 'falecido' : irmao.situacao === 'falecido') && (
                    <div>
                      <label style={rotuloCampo}>
                        Data do Falecimento
                        {modoEdicao && (
                          <span className="block text-xs font-normal mt-0.5">
                            Após esta data, não aparecerá nas listas de presença
                          </span>
                        )}
                      </label>
                      {modoEdicao ? (
                        <input
                          type="date"
                          value={irmaoForm.data_falecimento || ''}
                          onChange={(e) => setIrmaoForm({ ...irmaoForm, data_falecimento: e.target.value })}
                          style={campoInput}
                        />
                      ) : (
                        <p style={valorCampo}>
                          {irmao.data_falecimento ? irmao.data_falecimento.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {modoEdicao && !['falecido'].includes(irmaoForm.situacao) && (
                  <p className="text-sm italic mt-2">
                    ℹ️ Para registrar licenças e desligamentos, use a aba "Situações"
                  </p>
                )}
                
                {/* Informação sobre prerrogativa por idade */}
                {(modoEdicao ? irmaoForm.data_nascimento : irmao.data_nascimento) && (() => {
                  const calcularIdade = (dataNasc) => {
                    if (!dataNasc) return 0;
                    const hoje = new Date();
                    const nascimento = new Date(dataNasc);
                    let idade = hoje.getFullYear() - nascimento.getFullYear();
                    const m = hoje.getMonth() - nascimento.getMonth();
                    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
                      idade--;
                    }
                    return idade;
                  };
                  
                  const idade = calcularIdade(modoEdicao ? irmaoForm.data_nascimento : irmao.data_nascimento);
                  if (idade >= 70) {
                    return (
                      <div className="mt-3 p-3 rounded" style={{background:"var(--color-accent-bg)",border:"1px solid var(--color-border)"}}>
                        <p style={{fontSize:"0.875rem",color:"var(--color-text)"}}>
                          💡 <strong>Com Prerrogativa por Idade</strong> - Este irmão tem {idade} anos.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* LINHA 2: DATAS ESPECÍFICAS DA SITUAÇÃO - Já está no lugar correto */}

              {/* LINHA 3: DATA DE INGRESSO NA LOJA */}
              <div className="border-l-4 p-4 rounded-lg" style={{background:"var(--color-accent-bg)",borderLeftColor:"var(--color-accent)"}}>
                <div>
                  <label style={rotuloCampo}>
                    ➡️ Data de Ingresso na Loja
                    <span className="block text-xs font-normal">Quando veio transferido de outra loja</span>
                  </label>
                  {modoEdicao ? (
                    <>
                      <input
                        type="date"
                        value={irmaoForm.data_ingresso_loja || ''}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_ingresso_loja: e.target.value })}
                        style={campoInput}
                      />
                      <p className="text-xs mt-1">
                        ℹ️ Deixe vazio se foi iniciado nesta loja. Para transferências de saída, use a aba "Situações"
                      </p>
                    </>
                  ) : (
                    <p style={valorCampo}>
                      {irmao.data_ingresso_loja ? irmao.data_ingresso_loja.split('-').reverse().join('/') : 'Iniciado nesta loja'}
                    </p>
                  )}
                </div>
              </div>

              {/* Quadro: Datas Maçônicas */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🕐 Datas Maçônicas</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label style={rotuloCampo}>🔨 Data de Iniciação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_iniciacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_iniciacao: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <div>
                      <p style={valorCampo}>
                        {irmao.data_iniciacao ? irmao.data_iniciacao.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                      </p>
                      {irmao.data_iniciacao && (
                        <p className="text-xs">{calcularTempoMaconaria(irmao.data_iniciacao)}</p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label style={rotuloCampo}>📐 Data de Elevação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_elevacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_elevacao: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>
                      {irmao.data_elevacao ? irmao.data_elevacao.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                    </p>
                  )}
                </div>

                <div>
                  <label style={rotuloCampo}>🏛️ Data de Exaltação</label>
                  {modoEdicao ? (
                    <input
                      type="date"
                      value={irmaoForm.data_exaltacao || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, data_exaltacao: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>
                      {irmao.data_exaltacao ? irmao.data_exaltacao.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                    </p>
                  )}
                </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{marginTop:"1rem"}}>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{color:"var(--color-text-muted)"}}>⭐ Mestre Instalado?</label>
                  {modoEdicao ? (
                    <div className="flex gap-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="mestre_instalado"
                          checked={irmaoForm.mestre_instalado === true}
                          onChange={() => setIrmaoForm({ ...irmaoForm, mestre_instalado: true })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="ml-2 text-sm">Sim</span>
                      </label>
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="mestre_instalado"
                          checked={irmaoForm.mestre_instalado === false}
                          onChange={() => setIrmaoForm({ ...irmaoForm, mestre_instalado: false, data_instalacao: '' })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="ml-2 text-sm">Não</span>
                      </label>
                    </div>
                  ) : (
                    <p style={valorCampo}>{irmao.mestre_instalado ? 'Sim' : 'Não'}</p>
                  )}
                </div>

                {(modoEdicao ? irmaoForm.mestre_instalado : irmao.mestre_instalado) && (
                  <div className="md:col-span-3">
                    <label style={rotuloCampo}>📅 Data de Instalação</label>
                    {modoEdicao ? (
                      <input
                        type="date"
                        value={irmaoForm.data_instalacao || ''}
                        onChange={(e) => setIrmaoForm({ ...irmaoForm, data_instalacao: e.target.value })}
                        style={campoInput}
                      />
                    ) : (
                      <p style={valorCampo}>
                        {irmao.data_instalacao ? irmao.data_instalacao.split('-').reverse().join('/') : <span style={vazioCampo}>Não informado</span>}
                      </p>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Quadro: Loja de Origem */}
              <div style={boxCard}>
                <h4 style={boxTitle}>🏛️ Loja de Origem</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label style={rotuloCampo}>Loja de Origem</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.loja_origem || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, loja_origem: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.loja_origem || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                <div>
                  <label style={rotuloCampo}>Oriente</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.oriente || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, oriente: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.oriente || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>

                <div>
                  <label style={rotuloCampo}>Potência</label>
                  {modoEdicao ? (
                    <input
                      type="text"
                      value={irmaoForm.grande_oriente || ''}
                      onChange={(e) => setIrmaoForm({ ...irmaoForm, grande_oriente: e.target.value })}
                      style={campoInput}
                    />
                  ) : (
                    <p style={valorCampo}>{irmao.grande_oriente || <span style={vazioCampo}>Não informado</span>}</p>
                  )}
                </div>
                </div>
              </div>

              {/* Quadro: Observações */}
              <div style={boxCard}>
                <h4 style={boxTitle}>📝 Observações</h4>
                {modoEdicao ? (
                  <textarea
                    value={irmaoForm.observacoes || ''}
                    onChange={(e) => setIrmaoForm({ ...irmaoForm, observacoes: e.target.value })}
                    rows={3}
                    style={campoInput}
                  />
                ) : (
                  <p style={valorCampo}>{irmao.observacoes || 'Nenhuma observação'}</p>
                )}
              </div>

              {/* HISTÓRICO DE CARGOS */}
              <div className="border-t pt-6">
                <div className="p-3 rounded-lg mb-4" style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                  <h4 className="text-md font-semibold flex items-center gap-2" style={{color:"var(--color-text)"}}>
                    <span>🏛️</span>
                    <span>Histórico de Cargos na Loja</span>
                  </h4>
                </div>

                {/* Formulário para adicionar cargo - apenas em modo edição */}
                {modoEdicao && (
                  <div className="p-4 rounded-lg mb-4" style={{background:"var(--color-accent-bg)",border:"1px solid var(--color-border)"}}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <label style={rotuloCampo}>Ano</label>
                        <input
                          type="number"
                          id="cargo-ano"
                          min="1900"
                          max="2100"
                          style={campoInput}
                          placeholder="Ex: 2024"
                        />
                      </div>
                      <div className="md:col-span-7">
                        <label style={rotuloCampo}>
                          Cargo(s) <span className="text-xs">(separe por vírgula se houver mais de um)</span>
                        </label>
                        <input
                          type="text"
                          id="cargo-nome"
                          style={campoInput}
                          placeholder="Ex: Tesoureiro, Bibliotecário"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            const ano = document.getElementById('cargo-ano').value;
                            const cargo = document.getElementById('cargo-nome').value;
                            if (!ano || !cargo) {
                              alert('Preencha ano e cargo!');
                              return;
                            }
                            setHistoricoCargos([...historicoCargos, { ano, cargo }]);
                            document.getElementById('cargo-ano').value = new Date().getFullYear();
                            document.getElementById('cargo-nome').value = '';
                          }}
                          className="w-full px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                        >
                          ➕ Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {historicoCargos.length > 0 ? (() => {
                  const total = historicoCargos.length;
                  const meio = Math.ceil(total / 2);
                  const colunas = [
                    { lista: historicoCargos.slice(0, meio), offset: 0 },
                    { lista: historicoCargos.slice(meio), offset: meio },
                  ];
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {colunas.map((coluna, colIdx) => (
                        coluna.lista.length > 0 && (
                          <div key={colIdx} className="border rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                            <table className="min-w-full divide-y">
                              <thead style={{background:"var(--color-surface-2)"}}>
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ano</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium uppercase" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Cargo(s)</th>
                                  {modoEdicao && (
                                    <th className="px-4 py-3 text-center text-xs font-medium uppercase w-32" style={{color:"var(--color-text-muted)",background:"var(--color-surface-2)"}}>Ações</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {coluna.lista.map((cargo, i) => {
                                  const index = coluna.offset + i;
                                  return (
                                    <tr key={index} className="hover:">
                                      <td className="px-4 py-3 whitespace-nowrap text-sm font-bold" style={{color:"var(--color-text)"}}>
                                        {cargo.ano}
                                      </td>
                                      <td className="px-4 py-3 text-sm font-bold" style={{color:"var(--color-text)"}}>
                                        {cargo.cargo.split(',').map((c, ci) => (
                                          <div key={ci} className="flex items-start gap-1">
                                            <span style={{color:"var(--color-accent)"}}>{ci + 1}.</span>
                                            <span>{c.trim()}</span>
                                          </div>
                                        ))}
                                      </td>
                                      {modoEdicao && (
                                        <td className="px-4 py-3 text-center whitespace-nowrap" style={{color:"var(--color-text)"}}>
                                          <div className="flex gap-2 justify-center">
                                            <button
                                              onClick={() => {
                                                const novoAno = prompt('Digite o novo ano:', cargo.ano);
                                                const novoCargo = prompt('Digite o(s) novo(s) cargo(s) (separe por vírgula):', cargo.cargo);
                                                if (novoAno && novoCargo) {
                                                  const novosHistorico = [...historicoCargos];
                                                  novosHistorico[index] = { ano: novoAno, cargo: novoCargo };
                                                  setHistoricoCargos(novosHistorico);
                                                }
                                              }}
                                              style={{padding:"0.2rem 0.5rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-md)",fontSize:"0.75rem",cursor:"pointer"}}
                                              title="Editar"
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              onClick={() => {
                                                if (window.confirm('Deseja excluir este registro?')) {
                                                  setHistoricoCargos(historicoCargos.filter((_, i2) => i2 !== index));
                                                }
                                              }}
                                              style={{padding:"0.15rem 0.5rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-sm)",fontSize:"0.72rem",cursor:"pointer"}}
                                              title="Excluir"
                                            >
                                              🗑️
                                            </button>
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      ))}
                    </div>
                  );
                })() : (
                  <div className="text-center py-8 rounded-lg">
                    <p className="text-sm">
                      Nenhum cargo registrado no histórico.
                    </p>
                  </div>
                )}
              </div>

              {/* Instruções Recebidas e Trabalhos Apresentados */}
              <div className="p-6 rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <InstrucoesTrabalhos
                  irmao={irmao}
                  showSuccess={showSuccess}
                  showError={showError}
                />
              </div>

              {/* Comendas — Grande Loja e Loja */}
              <QuadrosComendas irmaoId={irmaoId} />
            </div>
          )}

          {/* ABA: Dados Familiares */}
          {abaSelecionada === 'familiar' && (
            <div className="space-y-6">
              {/* Cônjuge */}
              <div className="p-6 rounded-lg border-2 border-pink-200" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="text-lg font-bold text-pink-900 mb-4 flex items-center gap-2" style={{color:"var(--color-text)"}}>
                  💑 Cônjuge
                </h4>
                {modoEdicao ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label style={rotuloCampo}>Nome</label>
                      <input
                        type="text"
                        value={familiares.conjuge?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, nome: e.target.value }
                        })}
                        style={campoInput}
                      />
                    </div>
                    <div>
                      <label style={rotuloCampo}>Data Nascimento</label>
                      <input
                        type="date"
                        value={familiares.conjuge?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, data_nascimento: e.target.value }
                        })}
                        style={campoInput}
                      />
                    </div>
                    <div>
                      <label style={rotuloCampo}>Data Casamento</label>
                      <input
                        type="date"
                        value={familiares.conjuge?.data_casamento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, data_casamento: e.target.value }
                        })}
                        style={campoInput}
                      />
                    </div>
                    <div>
                      <label style={rotuloCampo}>Profissão</label>
                      <input
                        type="text"
                        value={familiares.conjuge?.profissao || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, profissao: e.target.value }
                        })}
                        style={campoInput}
                      />
                    </div>
                    <div>
                      <label style={rotuloCampo}>E-mail</label>
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={familiares.conjuge?.email || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          conjuge: { ...familiares.conjuge, email: e.target.value }
                        })}
                        style={campoInput}
                      />
                    </div>
                  </div>
                ) : (
                  familiares.conjuge && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold">Nome:</span>
                        <span className="ml-2">{familiares.conjuge.nome}</span>
                      </div>
                      {familiares.conjuge.data_nascimento && (
                        <div>
                          <span className="font-semibold">Data de Nascimento:</span>
                          <span className="ml-2">
                            {familiares.conjuge.data_nascimento.split('-').reverse().join('/')}
                          </span>
                        </div>
                      )}
                      {familiares.conjuge.data_casamento && (
                        <div>
                          <span className="font-semibold">💑 Data de Casamento:</span>
                          <span className="ml-2">
                            {familiares.conjuge.data_casamento.split('-').reverse().join('/')}
                          </span>
                        </div>
                      )}
                      {familiares.conjuge.profissao && (
                        <div>
                          <span className="font-semibold">Profissão:</span>
                          <span className="ml-2">{familiares.conjuge.profissao}</span>
                        </div>
                      )}
                      {familiares.conjuge.email && (
                        <div>
                          <span className="font-semibold">E-mail:</span>
                          <span className="ml-2">{familiares.conjuge.email}</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Pais */}
              <div className="p-6 rounded-lg" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <h4 className="text-lg font-bold text-blue-900 mb-4" style={{color:"var(--color-text)"}}>👨‍👩‍👦 Pais</h4>
                {modoEdicao ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h5 className="font-semibold border-b pb-1">Pai</h5>
                      <input
                        type="text"
                        placeholder="Nome do Pai"
                        value={familiares.pais.pai?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, pai: { ...familiares.pais.pai, nome: e.target.value }}
                        })}
                        style={campoInput}
                      />
                      <input
                        type="date"
                        placeholder="Data Nascimento"
                        value={familiares.pais.pai?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, pai: { ...familiares.pais.pai, data_nascimento: e.target.value }}
                        })}
                        style={campoInput}
                      />
                      
                      {/* Checkbox Vivo */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!familiares.pais.pai?.falecido}
                          onChange={(e) => setFamiliares({
                            ...familiares,
                            pais: { 
                              ...familiares.pais, 
                              pai: { 
                                ...familiares.pais.pai, 
                                falecido: !e.target.checked,
                                data_obito: e.target.checked ? null : familiares.pais.pai?.data_obito
                              }
                            }
                          })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="text-sm font-medium">Vivo</span>
                      </label>
                      
                      {/* Data Óbito - aparece se falecido */}
                      {familiares.pais.pai?.falecido && (
                        <div>
                          <label style={rotuloCampo}>Data de Óbito</label>
                          <input
                            type="date"
                            value={familiares.pais.pai?.data_obito || ''}
                            onChange={(e) => setFamiliares({
                              ...familiares,
                              pais: { ...familiares.pais, pai: { ...familiares.pais.pai, data_obito: e.target.value }}
                            })}
                            style={campoInput}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <h5 className="font-semibold border-b pb-1">Mãe</h5>
                      <input
                        type="text"
                        placeholder="Nome da Mãe"
                        value={familiares.pais.mae?.nome || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, mae: { ...familiares.pais.mae, nome: e.target.value }}
                        })}
                        style={campoInput}
                      />
                      <input
                        type="date"
                        placeholder="Data Nascimento"
                        value={familiares.pais.mae?.data_nascimento || ''}
                        onChange={(e) => setFamiliares({
                          ...familiares,
                          pais: { ...familiares.pais, mae: { ...familiares.pais.mae, data_nascimento: e.target.value }}
                        })}
                        style={campoInput}
                      />
                      
                      {/* Checkbox Viva */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!familiares.pais.mae?.falecido}
                          onChange={(e) => setFamiliares({
                            ...familiares,
                            pais: { 
                              ...familiares.pais, 
                              mae: { 
                                ...familiares.pais.mae, 
                                falecido: !e.target.checked,
                                data_obito: e.target.checked ? null : familiares.pais.mae?.data_obito
                              }
                            }
                          })}
                          style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                        />
                        <span className="text-sm font-medium">Viva</span>
                      </label>
                      
                      {/* Data Óbito - aparece se falecida */}
                      {familiares.pais.mae?.falecido && (
                        <div>
                          <label style={rotuloCampo}>Data de Óbito</label>
                          <input
                            type="date"
                            value={familiares.pais.mae?.data_obito || ''}
                            onChange={(e) => setFamiliares({
                              ...familiares,
                              pais: { ...familiares.pais, mae: { ...familiares.pais.mae, data_obito: e.target.value }}
                            })}
                            style={campoInput}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  (familiares.pais.pai || familiares.pais.mae) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Visualização Pai */}
                      <div className="space-y-2">
                        <h5 className="font-semibold border-b pb-1">Pai</h5>
                        {familiares.pais.pai ? (
                          <>
                            <div className="text-sm">
                              <span className="font-medium">Nome:</span>
                              <span className="ml-2">{familiares.pais.pai.nome}</span>
                            </div>
                            {familiares.pais.pai.data_nascimento && (
                              <div className="text-sm">
                                <span className="font-medium">Nascimento:</span>
                                <span className="ml-2">
                                  {familiares.pais.pai.data_nascimento.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                            <div className="text-sm">
                              <span className="font-medium">Status:</span>
                              <span style={{marginLeft:'0.5rem',color:!familiares.pais.pai.falecido?'#10b981':'var(--color-text-muted)'}}>
                                {!familiares.pais.pai.falecido ? '✓ Vivo' : '✝ Falecido'}
                              </span>
                            </div>
                            {familiares.pais.pai.falecido && familiares.pais.pai.data_obito && (
                              <div className="text-sm">
                                <span className="font-medium">Data de Óbito:</span>
                                <span className="ml-2">
                                  {familiares.pais.pai.data_obito.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm">Não informado</p>
                        )}
                      </div>
                      {/* Visualização Mãe */}
                      <div className="space-y-2">
                        <h5 className="font-semibold border-b pb-1">Mãe</h5>
                        {familiares.pais.mae ? (
                          <>
                            <div className="text-sm">
                              <span className="font-medium">Nome:</span>
                              <span className="ml-2">{familiares.pais.mae.nome}</span>
                            </div>
                            {familiares.pais.mae.data_nascimento && (
                              <div className="text-sm">
                                <span className="font-medium">Nascimento:</span>
                                <span className="ml-2">
                                  {familiares.pais.mae.data_nascimento.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                            <div className="text-sm">
                              <span className="font-medium">Status:</span>
                              <span style={{marginLeft:'0.5rem',color:!familiares.pais.mae.falecido?'#10b981':'var(--color-text-muted)'}}>
                                {!familiares.pais.mae.falecido ? '✓ Viva' : '✝ Falecida'}
                              </span>
                            </div>
                            {familiares.pais.mae.falecido && familiares.pais.mae.data_obito && (
                              <div className="text-sm">
                                <span className="font-medium">Data de Óbito:</span>
                                <span className="ml-2">
                                  {familiares.pais.mae.data_obito.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm">Não informado</p>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Filhos */}
              {(familiares.filhos.length > 0 || modoEdicao) && (
                <div className="p-6 rounded-lg border-2 border-green-200" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <h4 className="text-lg font-bold text-green-900 mb-4" style={{color:"var(--color-text)"}}>👶 Filhos ({familiares.filhos.length})</h4>
                  
                  {modoEdicao && (
                    <div style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",padding:"1rem",display:"flex",flexDirection:"column",gap:"0.75rem",marginBottom:"1rem"}}>
                      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:"0.75rem"}}>
                        <div>
                          <label style={rotuloCampo}>Nome *</label>
                          <input 
                            type="text" 
                            value={filhoForm.nome}
                            onChange={(e) => setFilhoForm({...filhoForm, nome: e.target.value})}
                            placeholder="Nome do filho" 
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                        <div>
                          <label style={rotuloCampo}>Data Nascimento</label>
                          <input 
                            type="date" 
                            value={filhoForm.data_nascimento}
                            onChange={(e) => setFilhoForm({...filhoForm, data_nascimento: e.target.value})}
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none",boxSizing:"border-box"}}
                          />
                        </div>
                        <div>
                          <label style={rotuloCampo}>Sexo</label>
                          <select 
                            value={filhoForm.sexo}
                            onChange={(e) => setFilhoForm({...filhoForm, sexo: e.target.value})}
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none"}}
                          >
                            <option value="M">Masculino</option>
                            <option value="F">Feminino</option>
                          </select>
                        </div>
                        <div>
                          <label style={rotuloCampo}>Tipo de Vínculo</label>
                          <select 
                            value={filhoForm.tipo_vinculo}
                            onChange={(e) => setFilhoForm({...filhoForm, tipo_vinculo: e.target.value})}
                            style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none"}}
                          >
                            <option value="filho">Filho</option>
                            <option value="filha">Filha</option>
                            <option value="enteado">Enteado</option>
                            <option value="enteada">Enteada</option>
                            <option value="neto">Neto</option>
                            <option value="neta">Neta</option>
                            <option value="bisneto">Bisneto</option>
                            <option value="bisneta">Bisneta</option>
                          </select>
                        </div>
                      </div>

                      <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
                        <label style={{display:"flex",alignItems:"center",gap:"0.5rem",cursor:"pointer",fontSize:"0.875rem",color:"var(--color-text)",fontWeight:600}}>
                          <input
                            type="checkbox"
                            checked={filhoForm.vivo}
                            onChange={(e) => setFilhoForm({ ...filhoForm, vivo: e.target.checked, data_obito: e.target.checked ? '' : filhoForm.data_obito })}
                            style={{width:"1rem",height:"1rem",accentColor:"var(--color-accent)"}}
                          />
                          Vivo
                        </label>
                        {!filhoForm.vivo && (
                          <div style={{flex:1,maxWidth:"200px"}}>
                            <label style={rotuloCampo}>Data de Óbito</label>
                            <input
                              type="date"
                              value={filhoForm.data_obito}
                              onChange={(e) => setFilhoForm({ ...filhoForm, data_obito: e.target.value })}
                              style={{width:"100%",padding:"0.55rem 0.75rem",borderRadius:"var(--radius-md)",background:"var(--color-surface)",color:"var(--color-text)",border:"1px solid var(--color-border)",fontSize:"0.875rem",outline:"none",boxSizing:"border-box"}}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (!filhoForm.nome) { alert('Digite o nome!'); return; }
                            
                            const filhoData = {
                              nome: filhoForm.nome,
                              data_nascimento: filhoForm.data_nascimento || null,
                              sexo: filhoForm.sexo || 'M',
                              tipo_vinculo: filhoForm.tipo_vinculo || 'filho',
                              vivo: filhoForm.vivo !== undefined ? filhoForm.vivo : true,
                              data_obito: filhoForm.data_obito || null
                            };
                            
                            if (filhoEditandoIndex !== null) {
                              const novosFilhos = [...familiares.filhos];
                              novosFilhos[filhoEditandoIndex] = filhoData;
                              setFamiliares({ ...familiares, filhos: novosFilhos });
                              setFilhoEditandoIndex(null);
                            } else {
                              setFamiliares({
                                ...familiares,
                                filhos: [...familiares.filhos, filhoData]
                              });
                            }
                            setFilhoForm({ nome: '', data_nascimento: '', sexo: '', tipo_vinculo: '', vivo: true, data_obito: '' });
                          }}
                          style={{padding:"0.5rem 1rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
                        >
                          {filhoEditandoIndex !== null ? '💾 Salvar' : '➕ Adicionar'}
                        </button>
                        {filhoEditandoIndex !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilhoEditandoIndex(null);
                              setFilhoForm({ nome: '', data_nascimento: '', sexo: '', tipo_vinculo: '', vivo: true, data_obito: '' });
                            }}
                            style={{padding:"0.45rem 0.75rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-md)",cursor:"pointer"}}
                          >
                            ✕ Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {familiares.filhos.map((filho, index) => {
                      const sexo = filho.sexo || (filho.tipo === 'Filho' ? 'M' : 'F');
                      return (
                        <div key={index} className="rounded-lg p-4 border border-green-200" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">
                                {sexo === 'M' ? '👦' : '👧'}
                                {!filho.vivo && <span className="ml-1" title="Falecido">🕊️</span>}
                              </span>
                              <div>
                                <h5 className="font-semibold">{filho.nome}</h5>
                                <p className="text-xs">
                                  {sexo === 'M' ? 'Masculino' : 'Feminino'}
                                  {filho.tipo_vinculo && (
                                    <span className="ml-1 capitalize">({filho.tipo_vinculo})</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {modoEdicao && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setFilhoForm({
                                      ...filho,
                                      vivo: filho.vivo !== undefined ? filho.vivo : true,
                                      data_obito: filho.data_obito || ''
                                    });
                                    setFilhoEditandoIndex(index);
                                  }}
                                  style={{padding:"0.25rem 0.55rem",background:"var(--color-accent-bg)",color:"var(--color-accent)",border:"1px solid var(--color-accent)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => {
                                    const novosFilhos = familiares.filhos.filter((_, i) => i !== index);
                                    setFamiliares({ ...familiares, filhos: novosFilhos });
                                    if (filhoEditandoIndex === index) setFilhoEditandoIndex(null);
                                  }}
                                  style={{padding:"0.25rem 0.55rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",fontSize:"0.82rem",cursor:"pointer"}}
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>
                          {filho.data_nascimento && (
                            <div className="text-sm">
                              <span className="font-medium">Nascimento:</span>
                              <span className="ml-2">{filho.data_nascimento.split('-').reverse().join('/')}</span>
                              <span className="ml-2">({calcularIdade(filho.data_nascimento)})</span>
                            </div>
                          )}
                          <div className="text-sm">
                            <span className="font-medium">Status:</span>
                            <span style={{marginLeft:'0.5rem',color:filho.vivo?'#10b981':'var(--color-text-muted)'}}>
                              {filho.vivo ? '✓ Vivo(a)' : '✝ Falecido(a)'}
                            </span>
                          </div>
                          {!filho.vivo && filho.data_obito && (
                            <div className="text-sm">
                              <span className="font-medium">Data de Óbito:</span>
                              <span className="ml-2">{filho.data_obito.split('-').reverse().join('/')}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mensagem se não tiver familiares */}
              {!familiares.conjuge && !familiares.pais.pai && !familiares.pais.mae && familiares.filhos.length === 0 && (
                <div className="text-center py-12 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                  <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
                  <p className="text-lg font-medium">Nenhum familiar cadastrado</p>
                </div>
              )}
            </div>
          )}

          {/* ABA: Vida Maçônica */}
          {abaSelecionada === 'vida-maconica' && (
            <VidaMaconica
              irmaoId={irmaoId}
              showSuccess={showSuccess}
              showError={showError}
            />
          )}

          {/* ABA: Situações (Licenças, Desligamentos, etc) */}
          {abaSelecionada === 'situacoes' && (
            <GestaoSituacoes irmaId={irmaoId} />
          )}

          {/* ABA: Documentos */}
          {abaSelecionada === 'documentos' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold" style={{color:"var(--color-text)"}}>📄 Documentos</h2>
                
                {(permissoes?.pode_editar_irmaos || userEmail === irmao.email) && (
                  <label className="cursor-pointer bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors font-medium" style={{color:"var(--color-text-muted)"}}>
                    📤 Enviar PDF
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleUploadPDF}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {documentos.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg">Nenhum documento cadastrado</p>
                  <p className="text-sm mt-2">Use o botão acima para enviar arquivos PDF</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {documentos.map(doc => (
                    <div key={doc.id} className="border rounded-lg p-4 flex items-center justify-between hover: transition-shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">📄</span>
                        <div>
                          <p className="font-medium">{doc.nome_arquivo}</p>
                          <p className="text-sm">
                            Enviado em {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={doc.url_arquivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors text-sm"
                        >
                          👁️ Ver
                        </a>
                        {(permissoes?.pode_editar_irmaos || userEmail === irmao.email) && (
                          <button
                            onClick={() => handleExcluirDocumento(doc.id, doc.url_arquivo)}
                            style={{padding:"0.4rem 0.75rem",background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"var(--radius-md)",cursor:"pointer",fontSize:"0.82rem",fontWeight:"600"}}
                          >
                            🗑️ Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botões de Ação */}
      {abaSelecionada !== 'vida-maconica' && (
        <div className="flex gap-4 justify-end p-4 rounded-lg shadow" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          {modoEdicao ? (
            <>
              <button
                onClick={() => {
                  setModoEdicao(false);
                  setIrmaoForm(irmao);
                }}
                style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleSalvar}
                style={{padding:"0.5rem 1.5rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}
              >
                💾 Salvar Alterações
              </button>
            </>
          ) : (
            <>
              {/* Só pode editar se: é o próprio perfil OU tem permissão */}
              {(irmao?.email === userEmail || permissoes?.canEditMembers || permissoes?.canEdit) && (
                <button
                  onClick={() => setModoEdicao(true)}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  ✏️ Editar
                </button>
              )}
            </>
          )}
        </div>
      )}
      {modoEdicao && (
        <div style={{position:"sticky",bottom:0,zIndex:20,display:"flex",justifyContent:"flex-end",gap:"0.5rem",padding:"0.75rem 1rem",background:"var(--color-surface)",borderTop:"2px solid var(--color-accent)",borderRadius:"var(--radius-lg)",boxShadow:"0 -4px 12px rgba(0,0,0,0.25)"}}>
          <button onClick={() => { setModoEdicao(false); carregarIrmao(); }}
            style={{padding:"0.55rem 1.1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}>✕ Cancelar</button>
          <button onClick={handleSalvarEdicao}
            style={{padding:"0.55rem 1.4rem",background:"#10b981",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"700"}}>✓ Salvar</button>
        </div>
      )}

      {modalRelatorio && (
        <div onClick={() => setModalRelatorio(false)} style={{position:"fixed",inset:0,zIndex:60,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div onClick={(e) => e.stopPropagation()} style={{width:"100%",maxWidth:420,background:"var(--color-surface)",border:"1px solid var(--color-border)",borderTop:"4px solid #dc2626",borderRadius:"var(--radius-lg)",padding:"1.25rem"}}>
            <h3 style={{margin:0,fontSize:"1.1rem",fontWeight:800,color:"var(--color-text)"}}>📄 Relatório de Presença</h3>
            <div style={{fontSize:"0.8rem",color:"var(--color-text-muted)",margin:"0.25rem 0 1rem"}}>{irmao.nome}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
              <div>
                <label style={rotuloCampo}>De</label>
                <input type="date" value={relInicio} onChange={(e) => setRelInicio(e.target.value)}
                  style={{width:"100%",padding:"0.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
              </div>
              <div>
                <label style={rotuloCampo}>Até</label>
                <input type="date" value={relFim} onChange={(e) => setRelFim(e.target.value)}
                  style={{width:"100%",padding:"0.5rem",borderRadius:"var(--radius-md)",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}} />
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:"0.5rem",marginTop:"1.25rem"}}>
              <button onClick={() => setModalRelatorio(false)} style={{padding:"0.5rem 1rem",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:600}}>Cancelar</button>
              <button onClick={gerarRelatorioPresenca} disabled={gerandoRelatorio || !relInicio || !relFim || relInicio > relFim}
                style={{padding:"0.5rem 1.1rem",background:"#dc2626",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:gerandoRelatorio?"wait":"pointer",fontWeight:700,opacity:(gerandoRelatorio || !relInicio || !relFim || relInicio > relFim)?0.6:1}}>
                {gerandoRelatorio ? '⏳ Gerando...' : 'Gerar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
