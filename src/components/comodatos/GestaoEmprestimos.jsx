import React, { useState, useEffect } from 'react';
import { supabase } from '../../App';
// import { gerarTermoComodato } from './utils/termoComodatoPDF';

export default function GestaoEmprestimos({ showSuccess, showError, permissoes }) {
  const [emprestimos, setEmprestimos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('ativo');
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
      setEmprestimos(empData || []);

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
      // COMODANTE - APENAS NOME DA LOJA
      // ========================================
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Comodante:', 15, yPos);
      yPos += 5; // Espaço reduzido
      doc.setFont('helvetica', 'normal');
      doc.text(nomeLoja, 15, yPos);
      yPos += 8; // Espaço reduzido entre comodante e comodatário

      // ========================================
      // COMODATÁRIO - QUALIFICAÇÃO COMPLETA
      // ========================================
      doc.setFont('helvetica', 'bold');
      doc.text('Comodatário - Beneficiário:', 15, yPos);
      yPos += 5; // Espaço reduzido
      doc.setFont('helvetica', 'normal');
      
      const beneficiario = emprestimoCompleto.beneficiarios;
      const textoComodatario = `${beneficiario?.nome || ''},  brasileiro(a),  inscrito(a)  no  CPF  sob  nº ${beneficiario?.cpf || ''}, ${beneficiario?.rg ? `portador(a) do RG sob nº ${beneficiario.rg},` : ''} com endereço na ${beneficiario?.endereco || ''}, no Município de ${beneficiario?.cidade || ''}/${beneficiario?.estado || ''}.`;
      
      const linhasComodatario = doc.splitTextToSize(textoComodatario, 180);
      linhasComodatario.forEach(linha => {
        doc.text(linha, 15, yPos, { align: 'justify', maxWidth: 180 });
        yPos += 5;
      });
      yPos += 3; // Espaço reduzido

      // ========================================
      // RESPONSÁVEL (se houver)
      // ========================================
      if (responsaveis && responsaveis.length > 0) {
        const resp = responsaveis[0];
        doc.setFont('helvetica', 'bold');
        doc.text('Comodatário - Responsável:', 15, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(resp.nome || '', 15, yPos);
        yPos += 8;
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
      yPos += 5; // Espaço reduzido

      // ========================================
      // TEXTO DO COMODATO (da imagem)
      // ========================================
      doc.setFont('helvetica', 'normal');
      
      const textoComodato = `Este  Termo  de  Comodato  estabelece as condições do empréstimo gratuito do(s) bem(s) descrito(s)   acima,  o(s) qual(is)   é(são)    disponibilizado(s)    pela    Loja    Maçônica   -   ARLS  Acácia  de   Paranatinga   nº   30,   para   que  seja(m)    utilizado(s)    pelo    beneficiário  acima  identificado,  sendo  vedada  a  transferência   à   terceiros   sem  a autorização do cedente.

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
      doc.line(60, yPos, 160, yPos);
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

  const emprestimosFiltrados = emprestimos.filter(emp => {
    if (filtroStatus === 'todos') return true;
    return emp.status === filtroStatus;
  });

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">📦 Empréstimos</h2>
        {permissoes?.pode_editar_comodatos && (
          <button
            onClick={() => setModalAberto(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            ➕ Novo Empréstimo
          </button>
        )}
      </div>

      {/* FILTROS */}
      <div className="flex gap-2">
        {['ativo', 'devolvido', 'todos'].map(status => (
          <button
            key={status}
            onClick={() => setFiltroStatus(status)}
            className={`px-4 py-2 rounded-lg ${
              filtroStatus === status
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>

      {/* LISTA DE EMPRÉSTIMOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {emprestimosFiltrados.map(emp => (
          <div key={emp.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base">{emp.beneficiarios?.nome}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                  emp.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {emp.status?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-gray-600">CPF: {emp.beneficiarios?.cpf}</p>
              <p className="text-xs text-gray-500">
                Empréstimo: {new Date(emp.data_emprestimo).toLocaleDateString()}
              </p>
              {permissoes?.pode_editar_comodatos && (
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => gerarTermo(emp)}
                    className="flex-1 px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                    title="Gerar Termo de Comodato"
                  >
                    📄 Termo
                  </button>
                  <button
                    onClick={() => abrirEdicao(emp)}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    title="Editar empréstimo"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => excluirEmprestimo(emp)}
                    className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    title="Excluir empréstimo"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              )}
            </div>

            {/* ITENS DO EMPRÉSTIMO */}
            <div className="space-y-1">
              <p className="font-semibold text-xs text-gray-700 mb-1">Equipamentos:</p>
              {emp.itens?.map(item => (
                <div
                  key={item.id}
                  className={`p-2 rounded ${
                    item.status === 'devolvido' ? 'bg-gray-100' : 'bg-emerald-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="text-xs font-medium flex-1">
                      {item.equipamentos?.numero_patrimonio} - {item.equipamentos?.tipos_equipamentos?.nome}
                    </p>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                      item.status === 'emprestado'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {item.status === 'emprestado' ? '🔄' : '✅'}
                    </span>
                  </div>
                  {item.status === 'devolvido' && item.data_devolucao_real && (
                    <p className="text-xs text-gray-500">
                      Devolvido: {new Date(item.data_devolucao_real).toLocaleDateString()}
                    </p>
                  )}
                  {item.status === 'emprestado' && permissoes?.pode_editar_comodatos && (
                    <button
                      onClick={() => devolverItem(emp.id, item.id, item.equipamento_id)}
                      className="w-full mt-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Devolver
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {emprestimosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum empréstimo encontrado
          </div>
        )}
      </div>

      {/* MODAL NOVO EMPRÉSTIMO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-4">
                {editando ? '✏️ Editar Empréstimo' : '📦 Novo Empréstimo'}
              </h3>
              <form onSubmit={salvarEmprestimo} className="space-y-4">
                {/* Beneficiário */}
                <div>
                  <label className="block text-sm font-medium mb-1">Beneficiário *</label>
                  <select
                    value={form.beneficiario_id}
                    onChange={(e) => setForm({...form, beneficiario_id: e.target.value})}
                    className="w-full border rounded p-2"
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
                <div>
                  <label className="block text-sm font-medium mb-1">Data Empréstimo *</label>
                  <input
                    type="date"
                    value={form.data_emprestimo}
                    onChange={(e) => setForm({...form, data_emprestimo: e.target.value})}
                    className="w-full border rounded p-2"
                    required
                  />
                </div>

                {/* Data Devolução Prevista */}
                <div>
                  <label className="block text-sm font-medium mb-1">Devolução Prevista</label>
                  <input
                    type="date"
                    value={form.data_devolucao_prevista}
                    onChange={(e) => setForm({...form, data_devolucao_prevista: e.target.value})}
                    className="w-full border rounded p-2"
                  />
                </div>

                {/* EQUIPAMENTOS - MÚLTIPLA SELEÇÃO */}
                <div className="border rounded p-3 bg-gray-50">
                  <label className="block text-sm font-medium mb-2">
                    Equipamentos * ({equipamentosSelecionados.length} selecionados)
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {equipamentos.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum equipamento disponível</p>
                    ) : (
                      equipamentos.map(eq => (
                        <label key={eq.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={equipamentosSelecionados.includes(eq.id)}
                            onChange={() => toggleEquipamento(eq.id)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">
                            {eq.numero_patrimonio} - {eq.tipos_equipamentos?.nome}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-medium mb-1">Observações</label>
                  <textarea
                    value={form.observacoes_entrega}
                    onChange={(e) => setForm({...form, observacoes_entrega: e.target.value})}
                    className="w-full border rounded p-2"
                    rows="3"
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={fecharModal}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
