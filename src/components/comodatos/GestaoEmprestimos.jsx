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
      let yPos = 20;

      // ========================================
      // CABEÇALHO CENTRALIZADO
      // ========================================
      
      // Logo (se houver)
      if (dadosLoja?.logo_url) {
        try {
          doc.addImage(dadosLoja.logo_url, 'PNG', 90, yPos, 30, 30);
          yPos += 35;
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
        yPos += 5;
      }
      if (dadosLoja?.cidade) {
        doc.text(`${dadosLoja.cidade}/${dadosLoja.estado || ''} - CEP: ${dadosLoja.cep || ''}`, 105, yPos, { align: 'center' });
        yPos += 5;
      }
      if (dadosLoja?.telefone) {
        doc.text(`Telefone: ${dadosLoja.telefone}`, 105, yPos, { align: 'center' });
        yPos += 5;
      }
      if (dadosLoja?.email) {
        doc.text(`E-mail: ${dadosLoja.email}`, 105, yPos, { align: 'center' });
        yPos += 5;
      }

      yPos += 5;

      // Linha separadora
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(15, yPos, 195, yPos);
      yPos += 10;

      // ========================================
      // TÍTULO DO DOCUMENTO
      // ========================================
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('TERMO DE COMODATO', 105, yPos, { align: 'center' });
      yPos += 7;
      
      doc.setFontSize(11);
      doc.text(`Nº ${String(emprestimo.id).padStart(4, '0')}/${new Date().getFullYear()}`, 105, yPos, { align: 'center' });
      yPos += 12;

      // ========================================
      // PREÂMBULO
      // ========================================
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Pelo presente instrumento particular, têm entre si:', 15, yPos);
      yPos += 10;

      // ========================================
      // COMODANTE
      // ========================================
      doc.setFont('helvetica', 'bold');
      doc.text('COMODANTE:', 15, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      
      const textoComodante = `${nomeLoja}, com sede na ${dadosLoja?.endereco || ''}, ${dadosLoja?.cidade || ''}/${dadosLoja?.estado || ''}, ${dadosLoja?.oriente ? `Oriente de ${dadosLoja.oriente}` : ''}, ${dadosLoja?.vale ? `Vale de ${dadosLoja.vale}` : ''}, ${dadosLoja?.grande_loja ? `jurisdicionada à ${dadosLoja.grande_loja}` : ''}, neste ato representada por seu Venerável Mestre, doravante denominada simplesmente COMODANTE;`;
      
      const linhasComodante = doc.splitTextToSize(textoComodante, 180);
      doc.text(linhasComodante, 15, yPos);
      yPos += linhasComodante.length * 5 + 8;

      // ========================================
      // COMODATÁRIO
      // ========================================
      doc.setFont('helvetica', 'bold');
      doc.text('COMODATÁRIO:', 15, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      
      const beneficiario = emprestimoCompleto.beneficiarios;
      const textoComodatario = `${beneficiario?.nome || ''}, brasileiro(a), inscrito(a) no CPF sob nº ${beneficiario?.cpf || ''}, ${beneficiario?.rg ? `portador(a) do RG sob nº ${beneficiario.rg},` : ''} com endereço na ${beneficiario?.endereco || ''}, no Município de ${beneficiario?.cidade || ''}/${beneficiario?.estado || ''}, doravante denominado(a) simplesmente COMODATÁRIO(A);`;
      
      const linhasComodatario = doc.splitTextToSize(textoComodatario, 180);
      doc.text(linhasComodatario, 15, yPos);
      yPos += linhasComodatario.length * 5 + 8;

      // ========================================
      // RESPONSÁVEL (se houver)
      // ========================================
      if (responsaveis && responsaveis.length > 0) {
        const resp = responsaveis[0];
        doc.setFont('helvetica', 'bold');
        doc.text('RESPONSÁVEL SOLIDÁRIO:', 15, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        
        const textoResponsavel = `${resp.nome || ''}, brasileiro(a), inscrito(a) no CPF sob nº ${resp.cpf || ''}, ${resp.parentesco || ''} do(a) COMODATÁRIO(A), residente na ${resp.endereco || ''}, telefone: ${resp.telefone || ''}, doravante denominado(a) simplesmente RESPONSÁVEL;`;
        
        const linhasResponsavel = doc.splitTextToSize(textoResponsavel, 180);
        doc.text(linhasResponsavel, 15, yPos);
        yPos += linhasResponsavel.length * 5 + 8;
      }

      // ========================================
      // PREÂMBULO DAS CLÁUSULAS
      // ========================================
      const preambulo = 'Têm entre si justo e contratado o presente TERMO DE COMODATO, regido pelas disposições dos artigos 579 a 585 do Código Civil Brasileiro e pelas cláusulas e condições seguintes:';
      const linhasPreambulo = doc.splitTextToSize(preambulo, 180);
      doc.text(linhasPreambulo, 15, yPos);
      yPos += linhasPreambulo.length * 5 + 10;

      // Verificar espaço
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // ========================================
      // CLÁUSULA PRIMEIRA - OBJETO
      // ========================================
      doc.setFont('helvetica', 'bold');
      doc.text('CLÁUSULA PRIMEIRA – DO OBJETO', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      doc.text('1.1. O COMODANTE cede ao COMODATÁRIO, em regime de comodato, sem ônus,', 15, yPos);
      yPos += 5;
      doc.text('os seguintes equipamentos de assistência social:', 15, yPos);
      yPos += 7;

      // Lista de equipamentos
      emprestimoCompleto.itens?.forEach((item, idx) => {
        const nomeEquip = item.equipamentos?.tipos_equipamentos?.nome || 'Equipamento';
        const patrimonio = item.equipamentos?.numero_patrimonio || 'S/N';
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}.`, 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${nomeEquip} - Patrimônio nº ${patrimonio}`, 27, yPos);
        yPos += 5;
      });
      yPos += 5;

      doc.text('1.2. O equipamento encontra-se em perfeito estado de conservação e funcionamento.', 15, yPos);
      yPos += 10;

      // ========================================
      // CLÁUSULA SEGUNDA - PRAZO
      // ========================================
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('CLÁUSULA SEGUNDA – DO PRAZO E FINALIDADE', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      const dataEmprestimo = new Date(emprestimoCompleto.data_emprestimo + 'T00:00:00').toLocaleDateString('pt-BR');
      let textoPrazo = `2.1. O prazo do presente comodato teve início em ${dataEmprestimo} e `;
      
      if (emprestimoCompleto.data_devolucao_prevista) {
        const dataDevolucao = new Date(emprestimoCompleto.data_devolucao_prevista + 'T00:00:00').toLocaleDateString('pt-BR');
        textoPrazo += `terá término previsto em ${dataDevolucao}, podendo ser prorrogado mediante acordo entre as partes.`;
      } else {
        textoPrazo += 'é por tempo indeterminado, devendo o equipamento ser devolvido quando não mais necessário ou quando solicitado pelo COMODANTE.';
      }
      
      const linhasPrazo = doc.splitTextToSize(textoPrazo, 180);
      doc.text(linhasPrazo, 15, yPos);
      yPos += linhasPrazo.length * 5 + 5;
      
      doc.text('2.2. O equipamento destina-se exclusivamente ao uso do COMODATÁRIO para fins de', 15, yPos);
      yPos += 5;
      doc.text('assistência médica/locomoção, sendo vedado qualquer uso diverso.', 15, yPos);
      yPos += 10;

      // ========================================
      // CLÁUSULA TERCEIRA - OBRIGAÇÕES DO COMODATÁRIO
      // ========================================
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO COMODATÁRIO', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      const obrigacoes = [
        '3.1. Conservar o equipamento em perfeito estado, conforme o recebeu;',
        '3.2. Utilizar o equipamento de acordo com sua finalidade específica;',
        '3.3. Não ceder, emprestar, alugar ou transferir o equipamento a terceiros, sob qualquer título;',
        '3.4. Comunicar imediatamente ao COMODANTE qualquer dano, defeito ou necessidade de',
        'manutenção do equipamento;',
        '3.5. Devolver o equipamento nas mesmas condições em que recebeu, ressalvado o desgaste',
        'natural pelo uso adequado;',
        '3.6. Zelar pela segurança do equipamento, evitando furto, roubo, extravio ou danos;',
        '3.7. Permitir a vistoria do equipamento pelo COMODANTE, mediante agendamento prévio.'
      ];
      
      obrigacoes.forEach(obr => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(obr, 15, yPos);
        yPos += 5;
      });
      yPos += 5;

      // ========================================
      // CLÁUSULA QUARTA - OBRIGAÇÕES DO COMODANTE
      // ========================================
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('CLÁUSULA QUARTA – DAS OBRIGAÇÕES DO COMODANTE', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      doc.text('4.1. Entregar o equipamento em perfeitas condições de uso;', 15, yPos);
      yPos += 5;
      doc.text('4.2. Realizar a manutenção preventiva do equipamento quando necessário;', 15, yPos);
      yPos += 5;
      doc.text('4.3. Substituir o equipamento em caso de defeito, se disponível em estoque.', 15, yPos);
      yPos += 10;

      // ========================================
      // CLÁUSULA QUINTA - DEVOLUÇÃO
      // ========================================
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('CLÁUSULA QUINTA – DA DEVOLUÇÃO', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      const textoDevolucao = '5.1. O COMODATÁRIO obriga-se a devolver o equipamento ao COMODANTE imediatamente quando: (a) não mais necessitar do bem; (b) for solicitado pelo COMODANTE; (c) findar o prazo estabelecido na Cláusula Segunda; ou (d) descumprir qualquer cláusula deste instrumento.';
      const linhasDevolucao = doc.splitTextToSize(textoDevolucao, 180);
      doc.text(linhasDevolucao, 15, yPos);
      yPos += linhasDevolucao.length * 5 + 5;
      
      doc.text('5.2. A devolução deverá ser feita na sede do COMODANTE, em dia útil.', 15, yPos);
      yPos += 10;

      // ========================================
      // CLÁUSULA SEXTA - PENALIDADES
      // ========================================
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('CLÁUSULA SEXTA – DAS PENALIDADES', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      const textoPenalidades = '6.1. Em caso de dano, perda, furto ou roubo do equipamento por culpa ou dolo do COMODATÁRIO, este se obriga a ressarcir o valor de mercado do bem, apurado mediante três orçamentos, sem prejuízo de outras medidas legais cabíveis.';
      const linhasPenalidades = doc.splitTextToSize(textoPenalidades, 180);
      doc.text(linhasPenalidades, 15, yPos);
      yPos += linhasPenalidades.length * 5 + 5;
      
      doc.text('6.2. O RESPONSÁVEL SOLIDÁRIO responde conjuntamente pelas obrigações do', 15, yPos);
      yPos += 5;
      doc.text('COMODATÁRIO previstas neste instrumento.', 15, yPos);
      yPos += 10;

      // ========================================
      // CLÁUSULA SÉTIMA - DISPOSIÇÕES GERAIS
      // ========================================
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('CLÁUSULA SÉTIMA – DISPOSIÇÕES GERAIS', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      
      doc.text('7.1. Este termo pode ser rescindido a qualquer tempo mediante notificação prévia de', 15, yPos);
      yPos += 5;
      doc.text('3 (três) dias por qualquer das partes.', 15, yPos);
      yPos += 5;
      doc.text('7.2. O presente comodato é realizado a título gratuito, sem qualquer ônus para o', 15, yPos);
      yPos += 5;
      doc.text('COMODATÁRIO.', 15, yPos);
      yPos += 5;
      const textoForo = `7.3. As partes elegem o foro da Comarca de ${dadosLoja?.cidade || ''} para dirimir quaisquer dúvidas ou controvérsias oriundas deste instrumento.`;
      const linhasForo = doc.splitTextToSize(textoForo, 180);
      doc.text(linhasForo, 15, yPos);
      yPos += linhasForo.length * 5 + 10;

      // ========================================
      // ENCERRAMENTO
      // ========================================
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }
      
      const textoEncerramento = 'E por estarem assim justos e contratados, assinam o presente instrumento em 2 (duas) vias de igual teor e forma.';
      const linhasEncerramento = doc.splitTextToSize(textoEncerramento, 180);
      doc.text(linhasEncerramento, 15, yPos);
      yPos += linhasEncerramento.length * 5 + 15;

      // ========================================
      // LOCAL E DATA
      // ========================================
      const hoje = new Date();
      const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
      const dataExtenso = `${dadosLoja?.cidade || ''}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
      
      doc.setFont('helvetica', 'normal');
      doc.text(dataExtenso, 105, yPos, { align: 'center' });
      yPos += 20;

      // ========================================
      // ASSINATURAS
      // ========================================
      if (yPos > 200) {
        doc.addPage();
        yPos = 60;
      }

      // COMODANTE
      doc.text('_'.repeat(65), 105, yPos, { align: 'center' });
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('COMODANTE', 105, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(nomeLoja, 105, yPos, { align: 'center' });
      yPos += 3;
      doc.text('Venerável Mestre: _______________________________', 105, yPos, { align: 'center' });
      yPos += 20;

      // COMODATÁRIO
      doc.setFontSize(10);
      doc.text('_'.repeat(65), 105, yPos, { align: 'center' });
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('COMODATÁRIO(A)', 105, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(beneficiario?.nome || '', 105, yPos, { align: 'center' });
      yPos += 3;
      doc.text(`CPF: ${beneficiario?.cpf || ''}`, 105, yPos, { align: 'center' });
      yPos += 20;

      // RESPONSÁVEL (se houver)
      if (responsaveis && responsaveis.length > 0) {
        const resp = responsaveis[0];
        doc.setFontSize(10);
        doc.text('_'.repeat(65), 105, yPos, { align: 'center' });
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('RESPONSÁVEL SOLIDÁRIO', 105, yPos, { align: 'center' });
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(resp.nome || '', 105, yPos, { align: 'center' });
        yPos += 3;
        doc.text(`CPF: ${resp.cpf || ''}`, 105, yPos, { align: 'center' });
      }

      // SALVAR
      doc.save(`Termo_Comodato_${emprestimo.id}_${beneficiario?.nome?.replace(/\s+/g,'_')}.pdf`);
      
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
