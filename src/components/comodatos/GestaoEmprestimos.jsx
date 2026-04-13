import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
// import { gerarTermoComodato } from './utils/termoComodatoPDF';

export default function GestaoEmprestimos({ showSuccess, showError, permissoes }) {
  const [emprestimos, setEmprestimos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroAno, setFiltroAno]       = useState('todos');
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [modalRelatorio, setModalRelatorio]   = useState(false);
  const [relAno, setRelAno]             = useState('todos');
  const [relPeriodo, setRelPeriodo]     = useState('ano');   // mes|trimestre|semestre|ano
  const [relMes, setRelMes]             = useState(new Date().getMonth());
  const [relTrimestre, setRelTrimestre] = useState(Math.floor(new Date().getMonth() / 3));
  const [relSemestre, setRelSemestre]   = useState(new Date().getMonth() < 6 ? 0 : 1);
  const [editando, setEditando] = useState(null);
  
  // Múltiplos equipamentos
  const [equipamentosSelecionados, setEquipamentosSelecionados] = useState([]);

  const [form, setForm] = useState({
    beneficiario_id: '',
    data_emprestimo: new Date().toISOString().split('T')[0],
    data_devolucao_prevista: '',
    observacoes_entrega: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Empréstimos com itens
      const { data: empData, error: empError } = await supabase
        .from('comodatos')
        .select(`
          *,
          beneficiarios (id, nome, cpf),
          itens:comodato_itens (
            id,
            equipamento_id,
            status,
            data_devolucao_real,
            equipamentos (
              id,
              numero_patrimonio,
              tipos_equipamentos (nome)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (empError) throw empError;
      const dados = empData || [];
      setEmprestimos(dados);
      // Anos disponíveis — extraídos dos empréstimos carregados
      const anos = [...new Set(dados
        .map(e => e.data_emprestimo ? new Date(e.data_emprestimo + 'T00:00:00').getFullYear() : null)
        .filter(Boolean)
      )].sort((a, b) => b - a);
      setAnosDisponiveis(anos);
      // anos disponíveis carregados — 'todos' é sempre válido

      // Equipamentos disponíveis
      const { data: eqData, error: eqError } = await supabase
        .from('equipamentos')
        .select(`
          id,
          numero_patrimonio,
          status,
          tipos_equipamentos (nome)
        `)
        .eq('status', 'disponivel')
        .order('numero_patrimonio');

      if (eqError) throw eqError;
      setEquipamentos(eqData || []);

      // Beneficiários
      const { data: benData, error: benError } = await supabase
        .from('beneficiarios')
        .select('id, nome, cpf')
        .order('nome');

      if (benError) throw benError;
      setBeneficiarios(benData || []);

      setLoading(false);
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao carregar dados');
      setLoading(false);
    }
  };

  const salvarEmprestimo = async (e) => {
    e.preventDefault();

    if (!form.beneficiario_id) {
      showError('Selecione um beneficiário!');
      return;
    }

    if (equipamentosSelecionados.length === 0) {
      showError('Selecione pelo menos um equipamento!');
      return;
    }

    try {
      if (editando) {
        // MODO EDIÇÃO
        // 1. Atualizar comodato
        const { error: comodatoError } = await supabase
          .from('comodatos')
          .update({
            beneficiario_id: form.beneficiario_id,
            data_emprestimo: form.data_emprestimo,
            data_devolucao_prevista: form.data_devolucao_prevista || null,
            observacoes_entrega: form.observacoes_entrega || null
          })
          .eq('id', editando.id);

        if (comodatoError) throw comodatoError;

        // 2. Buscar itens atuais
        const { data: itensAtuais } = await supabase
          .from('comodato_itens')
          .select('equipamento_id')
          .eq('comodato_id', editando.id)
          .eq('status', 'emprestado');

        const idsAtuais = itensAtuais?.map(i => i.equipamento_id) || [];
        
        // 3. Equipamentos removidos - liberar
        const removidos = idsAtuais.filter(id => !equipamentosSelecionados.includes(id));
        for (const eqId of removidos) {
          await supabase
            .from('comodato_itens')
            .delete()
            .eq('comodato_id', editando.id)
            .eq('equipamento_id', eqId);
          
          await supabase
            .from('equipamentos')
            .update({ status: 'disponivel' })
            .eq('id', eqId);
        }

        // 4. Equipamentos novos - adicionar
        const novos = equipamentosSelecionados.filter(id => !idsAtuais.includes(id));
        if (novos.length > 0) {
          const itensNovos = novos.map(eq_id => ({
            comodato_id: editando.id,
            equipamento_id: eq_id,
            status: 'emprestado'
          }));

          await supabase.from('comodato_itens').insert(itensNovos);

          for (const eq_id of novos) {
            await supabase
              .from('equipamentos')
              .update({ status: 'emprestado' })
              .eq('id', eq_id);
          }
        }

        showSuccess('Empréstimo atualizado!');
      } else {
        // MODO CRIAÇÃO
        // 1. Criar comodato
        const { data: comodato, error: comodatoError } = await supabase
          .from('comodatos')
          .insert([{
            beneficiario_id: form.beneficiario_id,
            data_emprestimo: form.data_emprestimo,
            data_devolucao_prevista: form.data_devolucao_prevista || null,
            observacoes_entrega: form.observacoes_entrega || null,
            status: 'ativo'
          }])
          .select()
          .single();

        if (comodatoError) throw comodatoError;

        // 2. Criar itens
        const itens = equipamentosSelecionados.map(eq_id => ({
          comodato_id: comodato.id,
          equipamento_id: eq_id,
          status: 'emprestado'
        }));

        const { error: itensError } = await supabase
          .from('comodato_itens')
          .insert(itens);

        if (itensError) throw itensError;

        // 3. Atualizar status dos equipamentos
        for (const eq_id of equipamentosSelecionados) {
          await supabase
            .from('equipamentos')
            .update({ status: 'emprestado' })
            .eq('id', eq_id);
        }

        showSuccess(`Empréstimo criado com ${equipamentosSelecionados.length} equipamento(s)!`);
      }

      fecharModal();
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError(error.message || 'Erro ao criar empréstimo');
    }
  };

  const abrirEdicao = async (emprestimo) => {
    setEditando(emprestimo);
    setForm({
      beneficiario_id: emprestimo.beneficiario_id,
      data_emprestimo: emprestimo.data_emprestimo,
      data_devolucao_prevista: emprestimo.data_devolucao_prevista || '',
      observacoes_entrega: emprestimo.observacoes_entrega || ''
    });

    // Carregar equipamentos emprestados (não devolvidos)
    const equipamentosEmprestados = emprestimo.itens
      ?.filter(item => item.status === 'emprestado')
      .map(item => item.equipamento_id) || [];
    
    setEquipamentosSelecionados(equipamentosEmprestados);

    // Carregar equipamentos disponíveis + os que já estão neste empréstimo
    const { data: eqDisponiveis } = await supabase
      .from('equipamentos')
      .select(`id, numero_patrimonio, status, tipos_equipamentos (nome)`)
      .eq('status', 'disponivel')
      .order('numero_patrimonio');

    const { data: eqDoEmprestimo } = await supabase
      .from('equipamentos')
      .select(`id, numero_patrimonio, status, tipos_equipamentos (nome)`)
      .in('id', equipamentosEmprestados)
      .order('numero_patrimonio');

    // Combinar e remover duplicatas
    const todosEquipamentos = [...(eqDisponiveis || []), ...(eqDoEmprestimo || [])];
    const unicos = todosEquipamentos.filter((eq, index, self) => 
      index === self.findIndex(e => e.id === eq.id)
    );
    
    setEquipamentos(unicos);
    setModalAberto(true);
  };

  const gerarTermo = async (emprestimo) => {
    try {
      showSuccess('Gerando Termo de Comodato...');

      // Importar jsPDF
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;

      // Buscar dados da loja
      const { data: dadosLoja } = await supabase
        .from('dados_loja')
        .select('*')
        .single();

      // Buscar dados completos
      const { data: emprestimoCompleto, error: erroEmp } = await supabase
        .from('comodatos')
        .select(`
          *,
          beneficiarios (*),
          itens:comodato_itens (
            *,
            equipamentos (*, tipos_equipamentos (*))
          )
        `)
        .eq('id', emprestimo.id)
        .single();

      if (erroEmp) throw erroEmp;

      // Buscar responsáveis
      const { data: responsaveis } = await supabase
        .from('responsaveis')
        .select('*')
        .eq('beneficiario_id', emprestimoCompleto.beneficiario_id);

      emprestimoCompleto.beneficiarios.responsaveis = responsaveis || [];

      // Gerar PDF
      const doc = new jsPDF();
      let yPos = 10; // Menos espaço do topo

      // ========================================
      // CABEÇALHO CENTRALIZADO
      // ========================================
      
      // Logo (se houver) - mais próximo do topo
      if (dadosLoja?.logo_url) {
        try {
          doc.addImage(dadosLoja.logo_url, 'PNG', 90, yPos, 30, 30);
          yPos += 37;
        } catch (e) {
          console.log('Logo não disponível');
        }
      }

      // Nome da Loja
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const nomeLoja = `${dadosLoja?.nome_loja || 'Loja Maçônica'} nº ${dadosLoja?.numero_loja || '30'}`;
      doc.text(nomeLoja, 105, yPos, { align: 'center' });
      yPos += 6;

      // Endereço
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (dadosLoja?.endereco) {
        doc.text(dadosLoja.endereco, 105, yPos, { align: 'center' });
        yPos += 4;
      }
      if (dadosLoja?.cidade) {
        doc.text(`${dadosLoja.cidade}/${dadosLoja.estado || ''} - CEP: ${dadosLoja.cep || ''}`, 105, yPos, { align: 'center' });
        yPos += 4;
      }
      if (dadosLoja?.telefone) {
        doc.text(`Telefone: ${dadosLoja.telefone}`, 105, yPos, { align: 'center' });
        yPos += 4;
      }

      yPos += 3; // Espaço reduzido

      // Linha separadora
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(15, yPos, 195, yPos);
      yPos += 8; // Espaço reduzido

      // ========================================
      // TÍTULO
      // ========================================
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('TERMO DE COMODATO', 105, yPos, { align: 'center' });
      yPos += 10; // Espaço reduzido

      // ========================================
      // COMODANTE - NOME EM NEGRITO NA MESMA LINHA
      // ========================================
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Comodante: ', 15, yPos);
      doc.text(nomeLoja, 42, yPos); // Nome em negrito
      yPos += 8; // Espaço reduzido entre comodante e comodatário

      // ========================================
      // COMODATÁRIO - NOME EM NEGRITO NA MESMA LINHA, QUALIFICAÇÃO ABAIXO
      // ========================================
      const beneficiario = emprestimoCompleto.beneficiarios;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Comodatário: ', 15, yPos);
      doc.text(beneficiario?.nome || '', 42, yPos); // Nome em negrito
      yPos += 5; // Próxima linha para qualificação
      
      // Qualificação na linha de baixo com data de nascimento
      doc.setFont('helvetica', 'normal');
      
      let textoQualificacao = 'brasileiro(a)';
      
      // Adicionar data de nascimento se existir
      if (beneficiario?.data_nascimento) {
        const dataNasc = new Date(beneficiario.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR');
        textoQualificacao += `, nascido(a) aos ${dataNasc}`;
      }
      
      textoQualificacao += `, inscrito(a) no CPF sob nº ${beneficiario?.cpf || ''}`;
      
      if (beneficiario?.rg) {
        textoQualificacao += `, portador(a) do RG sob nº ${beneficiario.rg}`;
      }
      
      textoQualificacao += `, com endereço na ${beneficiario?.endereco || ''}, no Município de ${beneficiario?.cidade || ''}/${beneficiario?.estado || ''}.`;
      
      const linhasQualificacao = doc.splitTextToSize(textoQualificacao, 180);
      linhasQualificacao.forEach(linha => {
        doc.text(linha, 15, yPos, { align: 'justify', maxWidth: 180 });
        yPos += 5;
      });
      yPos += 3; // Espaço reduzido

      // ========================================
      // RESPONSÁVEL (se houver) - MESMO PADRÃO DO BENEFICIÁRIO
      // ========================================
      if (responsaveis && responsaveis.length > 0) {
        const resp = responsaveis[0];
        
        doc.setFont('helvetica', 'bold');
        doc.text('Comodatário - Responsável: ', 15, yPos);
        doc.text(resp.nome || '', 75, yPos); // Nome em negrito ao lado
        yPos += 5; // Próxima linha para qualificação
        
        // Qualificação na linha de baixo
        doc.setFont('helvetica', 'normal');
        
        let textoQualificacaoResp = 'brasileiro(a)';
        
        textoQualificacaoResp += `, inscrito(a) no CPF sob nº ${resp.cpf || 'não informado'}`;
        
        if (resp.rg) {
          textoQualificacaoResp += `, portador(a) do RG sob nº ${resp.rg}`;
        }
        
        textoQualificacaoResp += `, com endereço na ${resp.endereco || 'não informado'}, no Município de ${resp.cidade || 'não informado'}/${resp.estado || 'MT'}.`;
        
        const linhasQualificacaoResp = doc.splitTextToSize(textoQualificacaoResp, 180);
        linhasQualificacaoResp.forEach(linha => {
          doc.text(linha, 15, yPos, { align: 'justify', maxWidth: 180 });
          yPos += 5;
        });
        yPos += 3; // Espaço reduzido
      }

      // ========================================
      // EQUIPAMENTOS
      // ========================================
      doc.setFont('helvetica', 'bold');
      doc.text('Equipamento(s):', 15, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      
      emprestimoCompleto.itens?.forEach((item) => {
        const nomeEquip = item.equipamentos?.tipos_equipamentos?.nome || 'Equipamento';
        const patrimonio = item.equipamentos?.numero_patrimonio || 'S/N';
        doc.text(`${nomeEquip} - Patrimônio: ${patrimonio}`, 15, yPos);
        yPos += 5;
      });
      yPos += 3; // Espaço reduzido

      // ========================================
      // PRAZO DE UTILIZAÇÃO
      // ========================================
      doc.setFont('helvetica', 'bold');
      doc.text('Prazo de utilização: ', 15, yPos);
      doc.setFont('helvetica', 'normal');
      
      if (emprestimoCompleto.data_devolucao_prevista) {
        const dataDevolucao = new Date(emprestimoCompleto.data_devolucao_prevista + 'T00:00:00').toLocaleDateString('pt-BR');
        doc.text(`Por tempo determinado até ${dataDevolucao}`, 56, yPos);
      } else {
        doc.text('Por prazo indeterminado', 56, yPos);
      }
      yPos += 8; // Espaço antes do texto do comodato

      // ========================================
      // TEXTO DO COMODATO (da imagem)
      // ========================================
      doc.setFont('helvetica', 'normal');
      
      const textoComodato = `Este  Termo  de  Comodato  estabelece as condições do empréstimo gratuito do(s) bem(s) descrito(s)   acima,  o(s) qual(is)   é(são)    disponibilizado(s)    pela    Loja    Maçônica   -   ARLS   Acácia   de   Paranatinga   nº    30,   para  que    seja(m)    utilizado(s)    pelo    beneficiário   acima   identificado,  sendo  vedada  a  transferência  à  terceiros sem  a autorização do cedente.

O beneficiário deve cuidar do(s) bem(s) disponibilizado(s) e devolvê-lo(s) em boas condições para uso  posterior,  e será  responsabilizado  por quaisquer danos ou perda.

Se  o(s)  bem(s)   disponibilizado(s)  não  seja(m)  mais  necessário(s) ao beneficiário identificado, que seja(m) o(s) mesmo(s) devidamente devolvido(s).

Caso  os  dados  de  endereço  ou de contato houver alterações,  solicitamos que as novas informações sejam nos enviados de imediato, para que seja possível o acesso e contato quando necessário.`;

      const linhasTexto = doc.splitTextToSize(textoComodato, 180);
      linhasTexto.forEach(linha => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(linha, 15, yPos, { align: 'justify', maxWidth: 180 });
        yPos += 5;
      });
      yPos += 10;

      // ========================================
      // LOCAL E DATA
      // ========================================
      if (yPos > 230) {
        doc.addPage();
        yPos = 40;
      }

      const hoje = new Date();
      const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
      const dataExtenso = `${dadosLoja?.cidade || 'Paranatinga-MT'}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
      
      doc.text(dataExtenso, 105, yPos, { align: 'center' });
      yPos += 15;

      // ========================================
      // LINHA DE ASSINATURA (conforme imagem)
      // ========================================
      
      // Linha única longa
      doc.line(60, yPos, 150, yPos);
      yPos += 5;

      // Texto centralizado
      doc.setFontSize(9);
      doc.text(`${nomeLoja}`, 105, yPos, { align: 'center' });
      yPos += 4;
      doc.text('Comodante', 105, yPos, { align: 'center' });
      yPos += 15;

      // ========================================
      // DUAS LINHAS DE ASSINATURA (conforme imagem)
      // ========================================
      
      // Linha esquerda
      doc.line(15, yPos, 95, yPos);
      // Linha direita
      doc.line(115, yPos, 195, yPos);
      yPos += 5;

      // Textos
      doc.text('Comodatário - Beneficiário', 55, yPos, { align: 'center' });
      doc.text('Comodatário - Responsável', 155, yPos, { align: 'center' });

      // SALVAR
      const nomeArquivo = `Termo_Comodato_${String(emprestimo.id).padStart(4, '0')}_${beneficiario?.nome?.replace(/\s+/g,'_') || 'Beneficiario'}.pdf`;
      doc.save(nomeArquivo);
      
      showSuccess('Termo gerado com sucesso!');
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao gerar termo: ' + error.message);
    }
  };

  const excluirEmprestimo = async (emprestimo) => {
    if (!window.confirm('Excluir este empréstimo? Os equipamentos serão liberados.')) return;

    try {
      // 1. Buscar todos os itens do empréstimo
      const { data: itens } = await supabase
        .from('comodato_itens')
        .select('equipamento_id')
        .eq('comodato_id', emprestimo.id);

      // 2. Liberar equipamentos
      for (const item of itens || []) {
        await supabase
          .from('equipamentos')
          .update({ status: 'disponivel' })
          .eq('id', item.equipamento_id);
      }

      // 3. Excluir itens (cascade vai excluir automaticamente, mas por segurança)
      await supabase
        .from('comodato_itens')
        .delete()
        .eq('comodato_id', emprestimo.id);

      // 4. Excluir empréstimo
      const { error } = await supabase
        .from('comodatos')
        .delete()
        .eq('id', emprestimo.id);

      if (error) throw error;

      showSuccess('Empréstimo excluído!');
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao excluir empréstimo');
    }
  };

  const devolverItem = async (comodatoId, itemId, equipamentoId) => {
    if (!window.confirm('Confirmar devolução deste equipamento?')) return;

    try {
      // 1. Marcar item como devolvido
      const { error: itemError } = await supabase
        .from('comodato_itens')
        .update({
          status: 'devolvido',
          data_devolucao_real: new Date().toISOString()
        })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // 2. Liberar equipamento
      await supabase
        .from('equipamentos')
        .update({ status: 'disponivel' })
        .eq('id', equipamentoId);

      // 3. Verificar se todos itens foram devolvidos
      const { data: itensRestantes } = await supabase
        .from('comodato_itens')
        .select('*')
        .eq('comodato_id', comodatoId)
        .eq('status', 'emprestado');

      // Se não tiver mais itens emprestados, marcar comodato como devolvido
      if (itensRestantes.length === 0) {
        await supabase
          .from('comodatos')
          .update({
            status: 'devolvido',
            data_devolucao_real: new Date().toISOString()
          })
          .eq('id', comodatoId);
      }

      showSuccess('Equipamento devolvido!');
      carregarDados();
    } catch (error) {
      console.error('Erro:', error);
      showError('Erro ao devolver equipamento');
    }
  };


  const gerarRelatorio = async () => {
    try {
      showSuccess('Gerando relatório...');

      const anoAtual = relAno; // pode ser número ou 'todos'

      // Filtro de período para o relatório
      const dentroDoperiodo = (emp) => {
        const dt = emp.data_emprestimo ? new Date(emp.data_emprestimo + 'T00:00:00') : null;
        if (!dt) return false;
        if (anoAtual !== 'todos' && dt.getFullYear() !== anoAtual) return false;
        if (anoAtual === 'todos') return true; // sem filtro de sub-período quando todos os anos
        if (relPeriodo === 'mes')       return dt.getMonth() === relMes;
        if (relPeriodo === 'trimestre') return Math.floor(dt.getMonth() / 3) === relTrimestre;
        if (relPeriodo === 'semestre')  return (dt.getMonth() < 6 ? 0 : 1) === relSemestre;
        return true;
      };

      const MESES_NOMES_REL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      const labelAno = anoAtual === 'todos' ? 'Todos os Anos' : String(anoAtual);
      const labelPeriodo = anoAtual === 'todos' ? 'Todos os Anos'
                         : relPeriodo === 'mes'       ? `${MESES_NOMES_REL[relMes]} ${anoAtual}`
                         : relPeriodo === 'trimestre' ? `${relTrimestre + 1}º Trimestre ${anoAtual}`
                         : relPeriodo === 'semestre'  ? `${relSemestre + 1}º Semestre ${anoAtual}`
                         : `Ano ${anoAtual}`;

      // Buscar empréstimos do ano (ativos + devolvidos)
      const { data: dadosLoja } = await supabase
        .from('dados_loja')
        .select('*')
        .single();

      let qRel = supabase
        .from('comodatos')
        .select(`
          *,
          beneficiarios (nome, cpf),
          itens:comodato_itens (
            id, status, data_devolucao_real,
            equipamentos (numero_patrimonio, tipos_equipamentos (nome))
          )
        `)
        .in('status', ['ativo', 'devolvido'])
        .order('data_emprestimo', { ascending: false });
      if (anoAtual !== 'todos') {
        qRel = qRel.gte('data_emprestimo', `${anoAtual}-01-01`).lte('data_emprestimo', `${anoAtual}-12-31`);
      }
      const { data: lista, error } = await qRel;

      if (error) throw error;
      const listaPeriodo = (lista || []).filter(dentroDoperiodo);

      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      await import('jspdf-autotable');

      const doc = new jsPDF('landscape');
      const pW = doc.internal.pageSize.getWidth();

      // ── Cabeçalho ──────────────────────────────────────────────────────────
      doc.setFillColor(30, 58, 95);
      doc.rect(0, 0, pW, 32, 'F');

      if (dadosLoja?.logo_url) {
        try { doc.addImage(dadosLoja.logo_url, 'PNG', pW - 36, 4, 24, 24); } catch {}
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ARLS Acácia de Paranatinga Nº 30', pW / 2, 12, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Relatorio de Emprestimos — ${labelPeriodo}`, pW / 2, 21, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, pW / 2, 28, { align: 'center' });

      // ── Totalizadores ───────────────────────────────────────────────────────
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const ativos    = listaPeriodo.filter(e => e.status === 'ativo');
      const devolvidos = listaPeriodo.filter(e => e.status === 'devolvido');
      const vencidos  = ativos.filter(e => {
        if (!e.data_devolucao_prevista) return false;
        return new Date(e.data_devolucao_prevista + 'T00:00:00') < hoje;
      });
      const totalItens = listaPeriodo.reduce((s, e) => s + (e.itens?.length || 0), 0);

      doc.setTextColor(30, 58, 95);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      const stats = [
        { label: 'Total de Emprestimos', val: listaPeriodo.length },
        { label: 'Ativos',               val: ativos.length },
        { label: 'Devolvidos',           val: devolvidos.length },
        { label: 'Vencidos',             val: vencidos.length },
        { label: 'Itens Emprestados',    val: totalItens },
      ];
      const totalW = pW - 20; // mesma largura da tabela (margin 10+10)
      const gap = 3;
      const boxW = (totalW - gap * 4) / 5;
      const boxH = 16, startX = 10, y = 36;
      stats.forEach((s, i) => {
        const x = startX + i * (boxW + gap);
        const isCrit = s.label === 'Vencidos' && s.val > 0;
        doc.setFillColor(isCrit ? 254 : 248, isCrit ? 242 : 250, isCrit ? 242 : 252);
        doc.setDrawColor(isCrit ? 239 : 226, isCrit ? 68 : 232, isCrit ? 68 : 240);
        doc.roundedRect(x, y, boxW, boxH, 3, 3, 'FD');
        doc.setTextColor(isCrit ? 185 : 30, isCrit ? 28 : 58, isCrit ? 28 : 95);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(String(s.val), x + boxW / 2, y + 8, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(s.label, x + boxW / 2, y + 13, { align: 'center' });
      });

      // ── Helpers de linha ────────────────────────────────────────────────────
      const buildRows = (empLista) => {
        const rows = [];
        empLista.forEach(emp => {
          const benNome = emp.beneficiarios?.nome || '—';
          const benCpf  = emp.beneficiarios?.cpf  || '—';
          const dtEmp   = emp.data_emprestimo
            ? new Date(emp.data_emprestimo + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
          const dtPrev  = emp.data_devolucao_prevista
            ? new Date(emp.data_devolucao_prevista + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

          // Vencido: ativo E data_devolucao_prevista < hoje (mesmo critério do frontend)
          const eVencido = emp.status === 'ativo'
            && !!emp.data_devolucao_prevista
            && new Date(emp.data_devolucao_prevista + 'T00:00:00') < hoje;

          (emp.itens || []).forEach(item => {
            const tipo = item.equipamentos?.tipos_equipamentos?.nome || '—';
            const patr = item.equipamentos?.numero_patrimonio || '—';
            // Item vencido: o empréstimo está vencido E o item ainda não foi devolvido
            const itemVencido = eVencido && item.status !== 'devolvido';
            const itemStatus  = item.status === 'devolvido' ? 'Devolvido' : (itemVencido ? 'Vencido' : 'Ativo');
            const dtDev = item.data_devolucao_real
              ? new Date(item.data_devolucao_real).toLocaleDateString('pt-BR') : '—';

            rows.push({ benNome, benCpf, tipo, patr, dtEmp, dtPrev, dtDev, status: itemStatus, itemVencido });
          });
        });
        return rows;
      };

      // Larguras proporcionais: soma = pW - 20 = 277mm
      const colStyles = {
        0: { halign: 'left', cellWidth: 56 },
        1: { cellWidth: 34 },
        2: { halign: 'left', cellWidth: 47 },
        3: { cellWidth: 27 },
        4: { cellWidth: 29 },
        5: { cellWidth: 29 },
        6: { cellWidth: 29 },
        7: { cellWidth: 26 },
      };
      const HEAD = [['Beneficiário', 'CPF', 'Tipo de Equipamento', 'Patrimônio', 'Dt. Empréstimo', 'Prev. Devolução', 'Dt. Devolução', 'Situação']];

      const makeDidParseCell = (rows) => (data) => {
        if (data.section !== 'body') return;
        const row = rows[data.row.index];
        if (!row) return;
        if (row.itemVencido) {
          data.cell.styles.fillColor = [255, 245, 245];
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 7) {
          if (row.status === 'Vencido')    { data.cell.styles.textColor = [185, 28, 28]; data.cell.styles.fontStyle = 'bold'; }
          else if (row.status === 'Devolvido') { data.cell.styles.textColor = [22, 101, 52]; }
          else                              { data.cell.styles.textColor = [30, 58, 95]; }
        }
      };

      // ── Seção 1: Ativos (incluindo vencidos) ────────────────────────────────
      const rowsAtivos = buildRows(ativos);
      let nextY = y + boxH + 4;

      // Cabeçalho seção Ativos
      doc.setFillColor(30, 58, 95);
      doc.roundedRect(10, nextY, pW - 20, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`EMPRESTIMOS ATIVOS  —  ${ativos.length} registro(s)   |   Vencidos: ${vencidos.length}`, 14, nextY + 5.5);
      nextY += 9;

      if (rowsAtivos.length > 0) {
        doc.autoTable({
          startY: nextY,
          head: HEAD,
          body: rowsAtivos.map(r => [r.benNome, r.benCpf, r.tipo, r.patr, r.dtEmp, r.dtPrev, r.dtDev, r.status]),
          styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold', halign: 'center' },
          columnStyles: colStyles,
          alternateRowStyles: { fillColor: [248, 250, 252] },
          didParseCell: makeDidParseCell(rowsAtivos),
          margin: { left: 10, right: 10 },
        });
        nextY = doc.lastAutoTable.finalY + 8;
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhum empréstimo ativo.', 14, nextY + 6);
        nextY += 14;
      }

      // ── Seção 2: Devolvidos ─────────────────────────────────────────────────
      const rowsDev = buildRows(devolvidos);

      // Cabeçalho seção Devolvidos
      doc.setFillColor(22, 101, 52);
      doc.roundedRect(10, nextY, pW - 20, 8, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`EMPRESTIMOS DEVOLVIDOS  —  ${devolvidos.length} registro(s)`, 14, nextY + 5.5);
      nextY += 9;

      if (rowsDev.length > 0) {
        doc.autoTable({
          startY: nextY,
          head: HEAD,
          body: rowsDev.map(r => [r.benNome, r.benCpf, r.tipo, r.patr, r.dtEmp, r.dtPrev, r.dtDev, r.status]),
          styles: { fontSize: 8, cellPadding: 3, halign: 'center' },
          headStyles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold', halign: 'center' },
          columnStyles: colStyles,
          alternateRowStyles: { fillColor: [240, 253, 244] },
          didParseCell: makeDidParseCell(rowsDev),
          margin: { left: 10, right: 10 },
        });
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhum empréstimo devolvido.', 14, nextY + 6);
      }

      // ── Rodapé ──────────────────────────────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${i} de ${totalPages} — Relatório gerado automaticamente pelo sistema`,
          pW / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' }
        );
      }

      doc.save(`Relatorio_Emprestimos_${labelAno}_${relPeriodo}.pdf`);
      showSuccess('Relatório gerado!');
    } catch (err) {
      console.error(err);
      showError('Erro ao gerar relatório: ' + err.message);
    }
  };

  const toggleEquipamento = (eqId) => {
    setEquipamentosSelecionados(prev =>
      prev.includes(eqId)
        ? prev.filter(id => id !== eqId)
        : [...prev, eqId]
    );
  };

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setEquipamentosSelecionados([]);
    setForm({
      beneficiario_id: '',
      data_emprestimo: new Date().toISOString().split('T')[0],
      data_devolucao_prevista: '',
      observacoes_entrega: ''
    });
  };

  // ── Helpers de vencimento ────────────────────────────────────────────────────
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const isVencido = (emp) => {
    if (emp.status !== 'ativo') return false;
    if (!emp.data_devolucao_prevista) return false;
    const prev = new Date(emp.data_devolucao_prevista + 'T00:00:00');
    return prev < hoje;
  };

  const diasVencido = (emp) => {
    if (!emp.data_devolucao_prevista) return 0;
    const prev = new Date(emp.data_devolucao_prevista + 'T00:00:00');
    return Math.floor((hoje - prev) / (1000 * 60 * 60 * 24));
  };

  const emprestimosFiltrados = emprestimos.filter(emp => {
    if (filtroStatus !== 'todos' && emp.status !== filtroStatus) return false;
    const dt = emp.data_emprestimo ? new Date(emp.data_emprestimo + 'T00:00:00') : null;
    if (!dt) return false;
    if (filtroAno !== 'todos' && dt.getFullYear() !== filtroAno) return false;
    return true;
  }).sort((a, b) => {
    const aVenc = isVencido(a) ? 0 : 1;
    const bVenc = isVencido(b) ? 0 : 1;
    return aVenc - bVenc;
  });

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="card">
        <div className="flex justify-between items-center">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              📦 Empréstimos
            </h2>
            {emprestimos.filter(isVencido).length > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff',
                borderRadius: '999px', padding: '0.2rem 0.65rem',
                fontSize: '0.8rem', fontWeight: '800',
                animation: 'pulse 2s infinite'
              }}>
                ⚠️ {emprestimos.filter(isVencido).length} vencido{emprestimos.filter(isVencido).length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setModalRelatorio(true)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              📊 Relatório
            </button>
            {permissoes?.pode_editar_comodatos && (
            <button
              onClick={() => setModalAberto(true)}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ➕ Novo Empréstimo
            </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Ano */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Ano</label>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value))}
            style={{ padding: '0.45rem 0.7rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.875rem' }}>
            <option value="todos">Todos os anos</option>
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Situação</label>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {[{ id: 'ativo', label: 'Ativos' }, { id: 'devolvido', label: 'Devolvidos' }, { id: 'todos', label: 'Todos' }].map(s => (
              <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                style={{ padding: '0.45rem 0.9rem', background: filtroStatus === s.id ? 'var(--color-accent)' : 'var(--color-surface-2)', color: filtroStatus === s.id ? 'white' : 'var(--color-text)', border: filtroStatus === s.id ? 'none' : '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contador */}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)', alignSelf: 'flex-end', paddingBottom: '0.1rem' }}>
          {emprestimosFiltrados.length} empréstimo(s)
          {emprestimosFiltrados.filter(isVencido).length > 0 && (
            <span style={{ marginLeft: '0.5rem', color: '#ef4444', fontWeight: '700' }}>
              · {emprestimosFiltrados.filter(isVencido).length} vencido(s)
            </span>
          )}
        </span>
      </div>

      {/* LISTA DE EMPRÉSTIMOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {emprestimosFiltrados.map(emp => {
          const vencido = isVencido(emp);
          const dias = vencido ? diasVencido(emp) : 0;
          return (
          <div key={emp.id} className="card" style={{
            borderLeft: `4px solid ${vencido ? '#ef4444' : 'var(--color-accent)'}`,
            outline: vencido ? '2px solid #ef4444' : 'none',
            outlineOffset: '0px',
            position: 'relative'
          }}>
            {/* Banner de vencido */}
            {vencido && (
              <div style={{
                position: 'absolute', top: 0, right: 0,
                background: '#ef4444', color: '#fff',
                fontSize: '0.65rem', fontWeight: '800',
                padding: '0.2rem 0.6rem',
                borderRadius: '0 var(--radius-lg) 0 0.4rem',
                letterSpacing: '0.05em'
              }}>
                ⚠️ VENCIDO
              </div>
            )}
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex justify-between items-start" style={{ paddingRight: vencido ? '5rem' : 0 }}>
                <h3 className="font-bold text-base" style={{ color: 'var(--color-text)' }}>
                  {emp.beneficiarios?.nome}
                </h3>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: emp.status === 'ativo' ? 'var(--color-success-bg)' : 'var(--color-surface-2)',
                  color: emp.status === 'ativo' ? 'var(--color-success)' : 'var(--color-text-secondary)'
                }}>
                  {emp.status?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                CPF: {emp.beneficiarios?.cpf}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Empréstimo: {new Date(emp.data_emprestimo + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
              {emp.data_devolucao_prevista && (
                <p className="text-xs" style={{ color: vencido ? '#ef4444' : 'var(--color-text-secondary)', fontWeight: vencido ? '700' : '400' }}>
                  {vencido
                    ? `⏰ Venceu há ${dias} dia${dias !== 1 ? 's' : ''} — ${new Date(emp.data_devolucao_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}`
                    : `Devolução prevista: ${new Date(emp.data_devolucao_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                </p>
              )}
              {permissoes?.pode_editar_comodatos && (
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => gerarTermo(emp)}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      background: 'var(--color-accent)',
                      color: 'white',
                      fontSize: '0.75rem',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                    title="Gerar Termo de Comodato"
                  >
                    📄 Termo
                  </button>
                  <button
                    onClick={() => abrirEdicao(emp)}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      background: 'var(--color-info)',
                      color: 'white',
                      fontSize: '0.75rem',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                    title="Editar empréstimo"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => excluirEmprestimo(emp)}
                    style={{
                      flex: 1,
                      padding: '0.25rem 0.5rem',
                      background: 'var(--color-danger)',
                      color: 'white',
                      fontSize: '0.75rem',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                    title="Excluir empréstimo"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              )}
            </div>

            {/* ITENS DO EMPRÉSTIMO */}
            <div className="space-y-1">
              <p className="font-semibold text-xs mb-1" style={{ color: 'var(--color-text)' }}>
                Equipamentos:
              </p>
              {emp.itens?.map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.25rem',
                    background: item.status === 'devolvido' ? 'var(--color-surface-2)' : 'var(--color-success-bg)'
                  }}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="text-xs font-medium flex-1" style={{ color: 'var(--color-text)' }}>
                      {item.equipamentos?.numero_patrimonio} - {item.equipamentos?.tipos_equipamentos?.nome}
                    </p>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      background: item.status === 'emprestado' ? 'var(--color-warning-bg)' : 'var(--color-surface-2)',
                      color: item.status === 'emprestado' ? 'var(--color-warning)' : 'var(--color-text-secondary)'
                    }}>
                      {item.status === 'emprestado' ? '🔄' : '✅'}
                    </span>
                  </div>
                  {item.status === 'devolvido' && item.data_devolucao_real && (
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Devolvido: {new Date(item.data_devolucao_real).toLocaleDateString()}
                    </p>
                  )}
                  {item.status === 'emprestado' && permissoes?.pode_editar_comodatos && (
                    <button
                      onClick={() => devolverItem(emp.id, item.id, item.equipamento_id)}
                      style={{
                        width: '100%',
                        marginTop: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        background: 'var(--color-info)',
                        color: 'white',
                        fontSize: '0.75rem',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: 'pointer'
                      }}
                    >
                      Devolver
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
        })}

        {emprestimosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum empréstimo encontrado
          </div>
        )}
      </div>


      {/* MODAL RELATÓRIO */}
      {modalRelatorio && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', margin: 0, fontSize: '1.1rem' }}>📊 Gerar Relatório</h3>
              <button onClick={() => setModalRelatorio(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Ano */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Ano</label>
                <select value={relAno} onChange={e => setRelAno(parseInt(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                  {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Período */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Período</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {[{ id: 'mes', label: 'Mês' }, { id: 'trimestre', label: 'Trimestre' }, { id: 'semestre', label: 'Semestre' }, { id: 'ano', label: 'Ano todo' }].map(p => (
                    <button key={p.id} onClick={() => setRelPeriodo(p.id)}
                      style={{ padding: '0.4rem 0.9rem', background: relPeriodo === p.id ? 'var(--color-accent)' : 'var(--color-surface-2)', color: relPeriodo === p.id ? 'white' : 'var(--color-text)', border: relPeriodo === p.id ? 'none' : '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-período */}
              {relPeriodo === 'mes' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Mês</label>
                  <select value={relMes} onChange={e => setRelMes(parseInt(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', fontSize: '0.875rem' }}>
                    {['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
              )}
              {relPeriodo === 'trimestre' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Trimestre</label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {['1º (Jan–Mar)', '2º (Abr–Jun)', '3º (Jul–Set)', '4º (Out–Dez)'].map((t, i) => (
                      <button key={i} onClick={() => setRelTrimestre(i)}
                        style={{ padding: '0.4rem 0.7rem', background: relTrimestre === i ? 'var(--color-accent)' : 'var(--color-surface-2)', color: relTrimestre === i ? 'white' : 'var(--color-text)', border: relTrimestre === i ? 'none' : '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.78rem' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {relPeriodo === 'semestre' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Semestre</label>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {['1º (Jan–Jun)', '2º (Jul–Dez)'].map((s, i) => (
                      <button key={i} onClick={() => setRelSemestre(i)}
                        style={{ padding: '0.4rem 0.9rem', background: relSemestre === i ? 'var(--color-accent)' : 'var(--color-surface-2)', color: relSemestre === i ? 'white' : 'var(--color-text)', border: relSemestre === i ? 'none' : '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button onClick={() => setModalRelatorio(false)}
                  style={{ flex: 1, padding: '0.6rem', background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={() => { setModalRelatorio(false); gerarRelatorio(); }}
                  style={{ flex: 2, padding: '0.6rem', background: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: '700', cursor: 'pointer' }}>
                  📊 Gerar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO EMPRÉSTIMO */}
      {modalAberto && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 9999
        }}>
          <div className="card" style={{
            maxWidth: '42rem',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: 0
          }}>
            <div className="card-header">
              <h3 className="text-xl font-bold">
                {editando ? '✏️ Editar Empréstimo' : '📦 Novo Empréstimo'}
              </h3>
            </div>
            
            <form onSubmit={salvarEmprestimo} style={{
              padding: '1.5rem',
              flex: 1,
              overflowY: 'auto'
            }}>
              {/* Beneficiário */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Beneficiário *</label>
                <select
                  value={form.beneficiario_id}
                  onChange={(e) => setForm({...form, beneficiario_id: e.target.value})}
                  className="form-input"
                  required
                >
                  <option value="">Selecione...</option>
                  {beneficiarios.map(ben => (
                    <option key={ben.id} value={ben.id}>
                      {ben.nome} - {ben.cpf}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data Empréstimo */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Data Empréstimo *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.data_emprestimo}
                  onChange={(e) => setForm({...form, data_emprestimo: e.target.value})}
                  required
                />
              </div>

              {/* Data Devolução Prevista */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Devolução Prevista</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.data_devolucao_prevista}
                  onChange={(e) => setForm({...form, data_devolucao_prevista: e.target.value})}
                />
              </div>

              {/* EQUIPAMENTOS - MÚLTIPLA SELEÇÃO */}
              <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                background: 'var(--color-surface-2)',
                marginBottom: '1rem'
              }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                  Equipamentos * ({equipamentosSelecionados.length} selecionados)
                </label>
                <div style={{ maxHeight: '12rem', overflowY: 'auto' }} className="space-y-1">
                  {equipamentos.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Nenhum equipamento disponível
                    </p>
                  ) : (
                    equipamentos.map(eq => (
                      <label key={eq.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={equipamentosSelecionados.includes(eq.id)}
                          onChange={() => toggleEquipamento(eq.id)}
                          style={{ width: '1rem', height: '1rem' }}
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                          {eq.numero_patrimonio} - {eq.tipos_equipamentos?.nome}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Observações */}
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Observações</label>
                <textarea
                  className="form-input"
                  value={form.observacoes_entrega}
                  onChange={(e) => setForm({...form, observacoes_entrega: e.target.value})}
                  rows="3"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={fecharModal}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-surface-3)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1"
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
