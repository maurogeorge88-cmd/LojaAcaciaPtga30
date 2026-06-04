import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';

// ── Modelos padrão — usados para popular o banco na primeira abertura ──────
const MODELOS_PADRAO = [
  {
    tipo: 'edital_eleicao',
    nome: 'Edital de Convocação para Eleição',
    titulo_doc: 'Edital de Convocação para Eleição',
    corpo: 'Na qualidade de Venerável Mestre, Sr. {vm_nome}, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica {nome_loja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Eleição do Corpo Administrativo da Augusta e Respeitável Loja Simbólica {nome_loja} – Gestão {gestao}, a realizar-se no dia {data_eleicao}, às {hora_eleicao} horas nas dependências do nosso Templo, conforme estabelece o Artigo 187 do Regulamento Geral.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'edital_posse',
    nome: 'Edital de Convocação para Posse',
    titulo_doc: 'Edital de Convocação para Posse',
    corpo: 'Na qualidade de Venerável Mestre, Sr. {vm_nome}, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica {nome_loja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Posse do Corpo Administrativo da Augusta e Respeitável Loja Simbólica {nome_loja} – Gestão {gestao}, a realizar-se no dia {data_posse}, às {hora_posse} horas nas dependências do nosso Templo, conforme estabelece o Artigo 187 do Regulamento Geral.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'ata_eleicao_loja',
    nome: 'Ata de Eleição (Loja)',
    titulo_doc: 'ATA DA SESSÃO ORDINÁRIA DE ELEIÇÃO DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao}',
    corpo: 'Aos {data_eleicao} (E∴ V∴), às {hora_eleicao} horas, atendendo à convocação feita por Edital, reuniram-se no Oriente de {cidade}, Estado de {estado}, na {endereco_loja}, cidade de {cidade}/{estado}, no Templo os Mestres Maçons e membros ativos do Quadro da Augusta e Respeitável Loja Simbólica {nome_loja}, sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, em SESSÃO ORDINÁRIA, para o fim especial de realizarem as eleições para os cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico, e artigos 29, 30, 31, 32, 33, 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº {num_loja}. Presentes os irmãos que preencheram os cargos, estando todos revestidos de suas insígnias, sob a presidência do Venerável Mestre (Presidente) {vm_nome}, e pelos membros, {orador_nome} e {secretario_nome}, Orador e Secretário, respectivamente, estando os demais cargos regularmente constituídos. Os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Venerável Mestre, dispensando-se a Leitura da Ata e Expedientes. Estavam presentes à sessão {num_votantes} membros votantes, conforme a lista de presença, e que foram declarados pelos Irmãos Chanceler e Tesoureiro como aptos ao exercício do voto. Então, por ordem do Venerável Mestre (Presidente) e {trecho_votacao} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa única que ficou composta dos seguintes cargos e seus membros e comissões:',
    corpo_aclamacao: 'por se tratar de chapa única, não houve composição de mesa eleitoral, motivo pelo qual, a votação foi por aclamação sendo aprovado a chapa única por todos os membros presentes, conforme constam suas assinaturas na folha de votação (anexo), sem nenhuma objeção ou abstenção.',
    corpo_disputa: 'foi constituída mesa eleitoral, procedendo-se à votação por meio de escrutínio secreto, tendo sido eleita a chapa vencedora por maioria dos presentes, conforme constam suas assinaturas na folha de votação (anexo).',
    rodape: 'Esta Ata é o que foi deliberado em Assembleia da Loja, em {data_eleicao}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, {secretario_nome} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'ata_eleicao_cartorio',
    nome: 'Ata de Eleição (Cartório)',
    titulo_doc: 'ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ELEIÇÃO DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao}',
    corpo: 'Aos {data_eleicao} da era vulgar, às {hora_eleicao} horas, reuniram-se em Sessão ordinária, para eleição dos cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do Regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico e artigo 3°, e artigos 29, 30, 31, 32, 33, 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº {num_loja}, na sua sede, localizada na {endereco_loja}, cidade de {cidade}/{estado}. Preenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete, dispensando-se a Leitura da Ata e Expedientes. Os trabalhos foram presididos pelo Venerável Mestre (Presidente) {vm_nome}, e pelos membros, {orador_nome} e {secretario_nome}, Orador e Secretário, respectivamente, {trecho_votacao} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa que ficou composta dos seguintes cargos e seus membros e comissões:',
    corpo_aclamacao: 'por se tratar de chapa única, não houve composição de mesa eleitoral. Estavam presentes à sessão {num_votantes} membros votantes, 1/3 do quórum mínimo exigido para aprovação pelo estatuto, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. Então, por ordem do Venerável Mestre (Presidente), foi votado por aclamação sendo aprovado a chapa única por todos os membros presentes, conforme constam suas assinaturas na folha de votação (anexo), sem nenhuma objeção ou abstenção.',
    corpo_disputa: 'foi constituída mesa eleitoral para o escrutínio secreto. Estavam presentes à sessão {num_votantes} membros votantes, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. A votação foi realizada e a chapa vencedora foi eleita por maioria dos presentes.',
    rodape: 'Esta Ata é o que foi deliberado em Assembleia da Loja, em {data_eleicao}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, {secretario_nome} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.',
    assinatura_1_cargo: 'Venerável Mestre', assinatura_2_cargo: 'Orador', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'ata_posse',
    nome: 'Ata de Posse',
    titulo_doc: 'ATA DA SESSÃO ORDINÁRIA DE POSSE DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao}',
    corpo: 'Aos {data_posse} (E∴ V∴), às {hora_posse} horas, atendendo à convocação feita por Edital, reuniram-se no Oriente de {cidade}, Estado de {estado}, na {endereco_loja}, cidade de {cidade}/{estado}, no Templo, os Mestres Maçons e membros ativos do Quadro da Augusta e Respeitável Loja Simbólica {nome_loja}, sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, em SESSÃO ORDINÁRIA, para o fim especial de realizarem a POSSE da nova diretoria eleita para a Gestão {gestao}. Os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Venerável Mestre {vm_nome}, dispensando-se a Leitura da Ata e Expedientes. Estavam presentes à sessão {num_votantes} membros, conforme lista de presença. Procedeu-se então à cerimônia de posse e instalação dos novos dirigentes para a Gestão {gestao}, tomando posse os seguintes membros:',
    corpo_aclamacao: '', corpo_disputa: '',
    rodape: 'Esta Ata é o que foi deliberado em Assembleia da Loja, em {data_posse}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, {secretario_nome} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.',
    assinatura_1_cargo: 'Venerável Mestre Instalador', assinatura_2_cargo: 'Venerável Mestre Empossado', assinatura_3_cargo: 'Secretário',
    alinhamento_titulo: 'center', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'requerimento_eleicao',
    nome: 'Requerimento — Eleição',
    titulo_doc: '',
    corpo: 'AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, pessoa jurídica de direito privado, inscrita no CNPJ/MF {cnpj}, com sede localizada na {endereco_loja}, cidade de {cidade}/{estado}, representada pelo seu secretário, Sr. {secretario_dados}. Vem com o devido respeito à presença de Vossa Senhoria, REQUERER, que digne em proceder com a averbação da ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ELEIÇÃO DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao} em Pessoas Jurídicas dessa Serventia, junto ao registro sob nº {numero_registro_cartorio}, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Presidente', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'left', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'requerimento_posse',
    nome: 'Requerimento — Posse',
    titulo_doc: '',
    corpo: 'AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, pessoa jurídica de direito privado, inscrita no CNPJ/MF {cnpj}, com sede localizada na {endereco_loja}, cidade de {cidade}/{estado}, representada pelo seu secretário, Sr. {secretario_dados}. Vem com o devido respeito à presença de Vossa Senhoria, REQUERER, que digne em proceder com a averbação da ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE POSSE DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA {nome_loja}, PARA O PERÍODO {gestao} em Pessoas Jurídicas dessa Serventia, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: 'Presidente', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'left', alinhamento_corpo: 'justify', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'lista_presenca_eleicao',
    nome: 'Lista de Presença — Eleição',
    titulo_doc: 'Lista de Presença — Sessão de Eleição',
    corpo: 'Gestão: {gestao}     Data: {data_eleicao}',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: '', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'center', alinhamento_assinatura: 'center',
  },
  {
    tipo: 'lista_presenca_posse',
    nome: 'Lista de Presença — Posse',
    titulo_doc: 'Lista de Presença — Sessão de Posse',
    corpo: 'Gestão: {gestao}     Data: {data_posse}',
    corpo_aclamacao: '', corpo_disputa: '', rodape: '',
    assinatura_1_cargo: '', assinatura_2_cargo: '', assinatura_3_cargo: '',
    alinhamento_titulo: 'center', alinhamento_corpo: 'center', alinhamento_assinatura: 'center',
  },
];

const VARIAVEIS_DISPONIVEIS = [
  { var: '{vm_nome}',                  desc: 'Nome do VM convocante' },
  { var: '{gestao}',                   desc: 'Gestão (ex: 2026/2027)' },
  { var: '{nome_loja}',                desc: 'Nome completo da loja' },
  { var: '{num_loja}',                 desc: 'Número da loja' },
  { var: '{data_eleicao}',             desc: 'Data da eleição (dd/mm/aaaa)' },
  { var: '{hora_eleicao}',             desc: 'Hora da eleição' },
  { var: '{data_edital_eleicao}',      desc: 'Data do edital de eleição por extenso' },
  { var: '{data_posse}',               desc: 'Data da posse (dd/mm/aaaa)' },
  { var: '{hora_posse}',               desc: 'Hora da posse' },
  { var: '{data_edital_posse}',        desc: 'Data do edital de posse por extenso' },
  { var: '{cidade}',                   desc: 'Cidade da loja' },
  { var: '{estado}',                   desc: 'Estado (UF)' },
  { var: '{endereco_loja}',            desc: 'Endereço da loja' },
  { var: '{data_fundacao}',            desc: 'Data de fundação' },
  { var: '{orador_nome}',              desc: 'Nome do Orador eleito' },
  { var: '{secretario_nome}',          desc: 'Nome do Secretário' },
  { var: '{secretario_dados}',         desc: 'Qualificação completa do Secretário' },
  { var: '{num_votantes}',             desc: 'Número de votantes presentes' },
  { var: '{trecho_votacao}',           desc: 'Trecho automático (aclamação ou disputa)' },
  { var: '{cnpj}',                     desc: 'CNPJ da loja' },
  { var: '{numero_registro_cartorio}', desc: 'Número do registro no cartório' },
];

const S = {
  card:  { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '1.25rem' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' },
  input: { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '0.6rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem', boxSizing: 'border-box', lineHeight: '1.6', resize: 'vertical', fontFamily: 'inherit' },
  btn: (cor = 'accent') => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem', fontSize: '0.82rem', fontWeight: 600,
    color: cor === 'surface' ? 'var(--color-text)' : 'white',
    background: cor === 'accent' ? 'var(--color-accent)' : cor === 'success' ? 'var(--color-success)' : cor === 'danger' ? '#ef4444' : 'var(--color-surface-2)',
    border: cor === 'surface' ? '1px solid var(--color-border)' : 'none',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s',
  }),
  select: { padding: '0.45rem 0.7rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.82rem' },
};

export default function ModelosDocumentos({ permissoes, showSuccess, showError }) {
  const [modelos, setModelos]           = useState([]);
  const [modeloAtivo, setModeloAtivo]   = useState(null);
  const [form, setForm]                 = useState({});
  const [loading, setLoading]           = useState(true);
  const [salvando, setSalvando]         = useState(false);
  const [abaSelecionada, setAba]        = useState('corpo');
  const [mostrarVars, setMostrarVars]   = useState(false);

  const podeEditar = permissoes?.pode_editar_corpo_admin || false;

  // ── Carregar modelos do banco ──────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('modelos_documentos')
      .select('*')
      .order('created_at');

    if (!data || data.length === 0) {
      // Primeira vez: popular com os padrões
      await popularPadroes();
    } else {
      // Verificar se faltam tipos e adicionar
      const tiposExistentes = data.map(m => m.tipo);
      const faltando = MODELOS_PADRAO.filter(m => !tiposExistentes.includes(m.tipo));
      if (faltando.length > 0) {
        await supabase.from('modelos_documentos').insert(faltando);
        const { data: atualizado } = await supabase.from('modelos_documentos').select('*').order('created_at');
        setModelos(atualizado || []);
      } else {
        setModelos(data);
      }
    }
    setLoading(false);
  }, []);

  const popularPadroes = async () => {
    const { data, error } = await supabase
      .from('modelos_documentos')
      .insert(MODELOS_PADRAO)
      .select();
    if (!error) setModelos(data || []);
  };

  useEffect(() => { carregar(); }, [carregar]);

  // ── Selecionar modelo para editar ─────────────────────────
  const selecionarModelo = (modelo) => {
    setModeloAtivo(modelo);
    setForm({ ...modelo });
    setAba('corpo');
  };

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  // ── Salvar ────────────────────────────────────────────────
  const salvar = async () => {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('modelos_documentos')
        .update({
          nome:                  form.nome,
          titulo_doc:            form.titulo_doc,
          corpo:                 form.corpo,
          corpo_aclamacao:       form.corpo_aclamacao,
          corpo_disputa:         form.corpo_disputa,
          rodape:                form.rodape,
          assinatura_1_cargo:    form.assinatura_1_cargo,
          assinatura_2_cargo:    form.assinatura_2_cargo,
          assinatura_3_cargo:    form.assinatura_3_cargo,
          alinhamento_titulo:    form.alinhamento_titulo,
          alinhamento_corpo:     form.alinhamento_corpo,
          alinhamento_assinatura:form.alinhamento_assinatura,
        })
        .eq('id', form.id);

      if (error) throw error;
      showSuccess('Modelo salvo com sucesso!');
      setModelos(prev => prev.map(m => m.id === form.id ? { ...m, ...form } : m));
      setModeloAtivo({ ...form });
    } catch (e) {
      showError('Erro ao salvar: ' + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // ── Restaurar padrão ──────────────────────────────────────
  const restaurarPadrao = async () => {
    if (!window.confirm('Restaurar este modelo para o texto padrão? Suas edições serão perdidas.')) return;
    const padrao = MODELOS_PADRAO.find(m => m.tipo === modeloAtivo.tipo);
    if (!padrao) return;
    setForm(prev => ({ ...prev, ...padrao }));
    showSuccess('Padrão carregado — clique em Salvar para confirmar.');
  };

  // ── Inserir variável no campo ativo ───────────────────────
  const inserirVariavel = (varName) => {
    // Insere no campo que estava em foco (fallback: corpo)
    const campo = document.activeElement?.name || 'corpo';
    const el = document.querySelector(`textarea[name="${campo}"], input[name="${campo}"]`);
    if (el) {
      const start = el.selectionStart;
      const end   = el.selectionEnd;
      const novoValor = el.value.substring(0, start) + varName + el.value.substring(end);
      handleChange(campo, novoValor);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + varName.length, start + varName.length);
      }, 10);
    } else {
      handleChange('corpo', (form.corpo || '') + varName);
    }
  };

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      Carregando modelos...
    </div>
  );

  const ABAS = [
    { id: 'corpo',       label: '📝 Texto Principal' },
    { id: 'aclamacao',   label: '🗳️ Aclamação/Disputa' },
    { id: 'rodape',      label: '📄 Rodapé' },
    { id: 'assinaturas', label: '✍️ Assinaturas' },
    { id: 'layout',      label: '🎨 Layout' },
  ];

  // Não mostrar abas que não se aplicam ao tipo
  const temAclamacao = modeloAtivo && (modeloAtivo.tipo.startsWith('ata_eleicao'));
  const temRodape    = modeloAtivo && (modeloAtivo.tipo.startsWith('ata_') || modeloAtivo.tipo.startsWith('requerimento_'));
  const temAss       = modeloAtivo && !modeloAtivo.tipo.startsWith('lista_presenca');

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* ── Coluna esquerda: lista de modelos ── */}
      <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0.25rem', marginBottom: '0.5rem' }}>
          📄 Modelos ({modelos.length})
        </div>
        {modelos.map(m => (
          <button key={m.id}
            onClick={() => selecionarModelo(m)}
            style={{
              textAlign: 'left', padding: '0.6rem 0.85rem',
              background: modeloAtivo?.id === m.id ? 'var(--color-accent-bg)' : 'var(--color-surface)',
              border: `1px solid ${modeloAtivo?.id === m.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              color: modeloAtivo?.id === m.id ? 'var(--color-accent)' : 'var(--color-text)',
              fontSize: '0.82rem', fontWeight: modeloAtivo?.id === m.id ? 700 : 400,
              transition: 'all 0.15s',
            }}>
            {m.nome}
          </button>
        ))}
      </div>

      {/* ── Coluna direita: editor ── */}
      {!modeloAtivo ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '3rem' }}>📝</div>
          <p>Selecione um modelo à esquerda para editar</p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

          {/* Header do editor */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)', margin: 0 }}>{modeloAtivo.nome}</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0.2rem 0 0' }}>
                Tipo: <code style={{ background: 'var(--color-surface-2)', padding: '0 0.3rem', borderRadius: '4px' }}>{modeloAtivo.tipo}</code>
              </p>
            </div>
            {podeEditar && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button style={S.btn('surface')} onClick={() => setMostrarVars(!mostrarVars)}>
                  {'{}'} Variáveis
                </button>
                <button style={S.btn('surface')} onClick={restaurarPadrao}>
                  🔄 Restaurar padrão
                </button>
                <button style={S.btn('success')} onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : '💾 Salvar'}
                </button>
              </div>
            )}
          </div>

          {/* Painel de variáveis */}
          {mostrarVars && (
            <div style={{ ...S.card, background: 'var(--color-surface-2)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '0.6rem', textTransform: 'uppercase' }}>
                Clique em uma variável para inserir no campo em foco:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {VARIAVEIS_DISPONIVEIS.map(v => (
                  <button key={v.var}
                    title={v.desc}
                    onClick={() => inserirVariavel(v.var)}
                    style={{
                      padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 600,
                      background: 'var(--color-accent-bg)', color: 'var(--color-accent)',
                      border: '1px solid rgba(201,168,76,0.3)', borderRadius: '999px', cursor: 'pointer',
                    }}>
                    {v.var}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Abas */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', gap: 0 }}>
            {ABAS
              .filter(a =>
                a.id === 'corpo'       ? true :
                a.id === 'aclamacao'  ? temAclamacao :
                a.id === 'rodape'     ? temRodape :
                a.id === 'assinaturas'? temAss :
                true
              )
              .map(a => (
                <button key={a.id}
                  onClick={() => setAba(a.id)}
                  style={{
                    padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                    background: 'transparent',
                    color: abaSelecionada === a.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    borderBottom: abaSelecionada === a.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                    marginBottom: '-2px', transition: 'all 0.15s',
                  }}>
                  {a.label}
                </button>
              ))}
          </div>

          {/* Conteúdo das abas */}
          <div style={{ flex: 1 }}>

            {/* ABA: Texto Principal */}
            {abaSelecionada === 'corpo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={S.label}>Nome do modelo</label>
                  <input name="nome" style={S.input} value={form.nome || ''} disabled={!podeEditar}
                    onChange={e => handleChange('nome', e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Título no documento</label>
                  <input name="titulo_doc" style={S.input} value={form.titulo_doc || ''} disabled={!podeEditar}
                    onChange={e => handleChange('titulo_doc', e.target.value)}
                    placeholder="Deixe vazio se não tiver título" />
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Suporta variáveis como {'{nome_loja}'}, {'{gestao}'}
                  </p>
                </div>
                <div>
                  <label style={S.label}>Texto do corpo</label>
                  <textarea name="corpo" style={{ ...S.textarea, minHeight: '260px' }}
                    value={form.corpo || ''} disabled={!podeEditar}
                    onChange={e => handleChange('corpo', e.target.value)} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    Use variáveis entre chaves: {'{vm_nome}'}, {'{data_eleicao}'}, etc. Clique em "{'{}'}  Variáveis" para ver todas.
                  </p>
                </div>
              </div>
            )}

            {/* ABA: Aclamação/Disputa */}
            {abaSelecionada === 'aclamacao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--color-accent-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-accent)', border: '1px solid rgba(201,168,76,0.3)' }}>
                  ℹ️ Este trecho é inserido automaticamente no lugar de <strong>{'{trecho_votacao}'}</strong> no texto principal, dependendo do tipo de votação escolhido na eleição.
                </div>
                <div>
                  <label style={S.label}>Trecho — Aclamação (chapa única)</label>
                  <textarea name="corpo_aclamacao" style={{ ...S.textarea, minHeight: '120px' }}
                    value={form.corpo_aclamacao || ''} disabled={!podeEditar}
                    onChange={e => handleChange('corpo_aclamacao', e.target.value)} />
                </div>
                <div>
                  <label style={S.label}>Trecho — Disputa entre chapas</label>
                  <textarea name="corpo_disputa" style={{ ...S.textarea, minHeight: '120px' }}
                    value={form.corpo_disputa || ''} disabled={!podeEditar}
                    onChange={e => handleChange('corpo_disputa', e.target.value)} />
                </div>
              </div>
            )}

            {/* ABA: Rodapé */}
            {abaSelecionada === 'rodape' && (
              <div>
                <label style={S.label}>Texto do rodapé / encerramento</label>
                <textarea name="rodape" style={{ ...S.textarea, minHeight: '160px' }}
                  value={form.rodape || ''} disabled={!podeEditar}
                  onChange={e => handleChange('rodape', e.target.value)}
                  placeholder="Texto exibido após a lista de eleitos ou o corpo principal" />
                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  Suporta as mesmas variáveis do corpo principal.
                </p>
              </div>
            )}

            {/* ABA: Assinaturas */}
            {abaSelecionada === 'assinaturas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  ℹ️ O nome de quem assina é preenchido automaticamente pelo sistema. Aqui você define apenas o <strong>cargo</strong> que aparece abaixo do nome. Deixe vazio para omitir a assinatura.
                </div>
                {[
                  { campo: 'assinatura_1_cargo', label: '1ª Assinatura — Cargo' },
                  { campo: 'assinatura_2_cargo', label: '2ª Assinatura — Cargo' },
                  { campo: 'assinatura_3_cargo', label: '3ª Assinatura — Cargo' },
                ].map(a => (
                  <div key={a.campo}>
                    <label style={S.label}>{a.label}</label>
                    <input name={a.campo} style={S.input} value={form[a.campo] || ''} disabled={!podeEditar}
                      onChange={e => handleChange(a.campo, e.target.value)}
                      placeholder="Ex: Venerável Mestre" />
                  </div>
                ))}
              </div>
            )}

            {/* ABA: Layout */}
            {abaSelecionada === 'layout' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {[
                  { campo: 'alinhamento_titulo',    label: 'Alinhamento do Título' },
                  { campo: 'alinhamento_corpo',     label: 'Alinhamento do Corpo' },
                  { campo: 'alinhamento_assinatura',label: 'Alinhamento das Assinaturas' },
                ].map(a => (
                  <div key={a.campo}>
                    <label style={S.label}>{a.label}</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {['left','center','justify'].map(op => (
                        <button key={op}
                          disabled={!podeEditar}
                          onClick={() => handleChange(a.campo, op)}
                          style={{
                            padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, cursor: podeEditar ? 'pointer' : 'default',
                            borderRadius: 'var(--radius-md)', border: `1px solid ${form[a.campo] === op ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            background: form[a.campo] === op ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                            color: form[a.campo] === op ? 'var(--color-accent)' : 'var(--color-text-muted)',
                          }}>
                          {op === 'left' ? '⬅ Esquerda' : op === 'center' ? '⬛ Centro' : '☰ Justificado'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Preview visual do layout */}
                <div style={{ ...S.card, marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Preview do layout
                  </div>
                  <div style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-md)', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: '0.8rem', lineHeight: '1.6' }}>
                    {form.titulo_doc && (
                      <div style={{ textAlign: form.alinhamento_titulo, fontWeight: 'bold', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                        {form.titulo_doc.replace(/\{[^}]+\}/g, m => `[${m.slice(1,-1)}]`)}
                      </div>
                    )}
                    <div style={{ textAlign: form.alinhamento_corpo, marginBottom: '0.75rem', textIndent: form.alinhamento_corpo === 'justify' ? '1.25cm' : 0 }}>
                      {(form.corpo || '').substring(0, 200).replace(/\{[^}]+\}/g, m => `[${m.slice(1,-1)}]`)}
                      {(form.corpo || '').length > 200 ? '...' : ''}
                    </div>
                    {form.assinatura_1_cargo && (
                      <div style={{ textAlign: form.alinhamento_assinatura, marginTop: '1.5rem' }}>
                        <div>___________________________________</div>
                        <div style={{ fontWeight: 'bold' }}>[Nome do Assinante]</div>
                        <div>{form.assinatura_1_cargo}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
