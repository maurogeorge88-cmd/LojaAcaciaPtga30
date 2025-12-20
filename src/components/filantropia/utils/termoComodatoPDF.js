/**
 * GERADOR DE TERMO DE COMODATO EM PDF
 * Gera documento formal de empréstimo de equipamentos
 */

export const gerarTermoComodato = async (emprestimo, dadosLoja, supabase) => {
  try {
    // Importar jsPDF dinamicamente
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    
    const doc = new jsPDF();
    let yPos = 15;

    // ========================================
    // CABEÇALHO COM LOGO
    // ========================================
    if (dadosLoja?.logo_url) {
      try {
        doc.addImage(dadosLoja.logo_url, 'PNG', 15, yPos, 30, 30);
      } catch (e) {
        console.log('Logo não pôde ser adicionada');
      }
    }

    // Dados da Loja (lado direito)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(dadosLoja?.nome_loja || 'Loja Maçônica', 200, yPos, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    yPos += 4;
    if (dadosLoja?.endereco) {
      doc.text(dadosLoja.endereco, 200, yPos, { align: 'right' });
      yPos += 3;
    }
    if (dadosLoja?.cidade) {
      doc.text(`${dadosLoja.cidade}/${dadosLoja.estado || ''}`, 200, yPos, { align: 'right' });
      yPos += 3;
    }
    if (dadosLoja?.telefone) {
      doc.text(`Tel: ${dadosLoja.telefone}`, 200, yPos, { align: 'right' });
    }

    yPos = 50;

    // ========================================
    // TÍTULO
    // ========================================
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMO DE COMODATO', 105, yPos, { align: 'center' });
    yPos += 6;
    
    doc.setFontSize(10);
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    doc.text(`Nº ${emprestimo.id}/${new Date().getFullYear()}`, 105, yPos, { align: 'center' });
    yPos += 10;

    // ========================================
    // PARTES
    // ========================================
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // COMODANTE
    doc.setFont('helvetica', 'bold');
    doc.text('COMODANTE:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    const textoComodante = `${dadosLoja?.nome_loja || 'Loja Maçônica'} nº ${dadosLoja?.numero_loja || ''}, com sede na ${dadosLoja?.endereco || ''}, ${dadosLoja?.cidade || ''}/${dadosLoja?.estado || ''}, ${dadosLoja?.oriente || ''} de ${dadosLoja?.vale || ''}, jurisdicionada à ${dadosLoja?.grande_loja || ''}, doravante denominada COMODANTE.`;
    
    const linhasComodante = doc.splitTextToSize(textoComodante, 180);
    doc.text(linhasComodante, 15, yPos);
    yPos += linhasComodante.length * 5 + 5;

    // COMODATÁRIO
    doc.setFont('helvetica', 'bold');
    doc.text('COMODATÁRIO:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    const textoComodatario = `${emprestimo.beneficiarios?.nome || ''}, portador(a) do CPF nº ${emprestimo.beneficiarios?.cpf || ''}, residente e domiciliado(a) na ${emprestimo.beneficiarios?.endereco || ''}, ${emprestimo.beneficiarios?.cidade || ''}/${emprestimo.beneficiarios?.estado || ''}, doravante denominado(a) COMODATÁRIO(A).`;
    
    const linhasComodatario = doc.splitTextToSize(textoComodatario, 180);
    doc.text(linhasComodatario, 15, yPos);
    yPos += linhasComodatario.length * 5 + 5;

    // RESPONSÁVEL (se houver)
    if (emprestimo.beneficiarios?.responsaveis && emprestimo.beneficiarios.responsaveis.length > 0) {
      const resp = emprestimo.beneficiarios.responsaveis[0];
      doc.setFont('helvetica', 'bold');
      doc.text('RESPONSÁVEL SOLIDÁRIO:', 15, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 5;
      
      const textoResponsavel = `${resp.nome || ''}, portador(a) do CPF nº ${resp.cpf || ''}, ${resp.parentesco || ''} do(a) COMODATÁRIO(A), residente na ${resp.endereco || ''}, telefone: ${resp.telefone || ''}, doravante denominado(a) RESPONSÁVEL.`;
      
      const linhasResponsavel = doc.splitTextToSize(textoResponsavel, 180);
      doc.text(linhasResponsavel, 15, yPos);
      yPos += linhasResponsavel.length * 5 + 5;
    }

    // ========================================
    // PREÂMBULO
    // ========================================
    const preambulo = 'Têm entre si justo e contratado o presente TERMO DE COMODATO, mediante as seguintes cláusulas e condições:';
    const linhasPreambulo = doc.splitTextToSize(preambulo, 180);
    doc.text(linhasPreambulo, 15, yPos);
    yPos += linhasPreambulo.length * 5 + 8;

    // Verificar se precisa nova página
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // ========================================
    // CLÁUSULAS
    // ========================================
    
    // CLÁUSULA PRIMEIRA - DO OBJETO
    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULA PRIMEIRA – DO OBJETO', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    doc.text('1.1. O COMODANTE cede ao COMODATÁRIO, em regime de comodato, sem ônus, os', 15, yPos);
    yPos += 5;
    doc.text('seguintes equipamentos de assistência social:', 15, yPos);
    yPos += 7;

    // Lista de equipamentos
    if (emprestimo.itens && emprestimo.itens.length > 0) {
      emprestimo.itens.forEach((item, idx) => {
        const nomeEquip = item.equipamentos?.tipos_equipamentos?.nome || 'Equipamento';
        const patrimonio = item.equipamentos?.numero_patrimonio || 'S/N';
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}.`, 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`${nomeEquip} - Patrimônio: ${patrimonio}`, 27, yPos);
        yPos += 5;
      });
    }
    yPos += 5;

    // CLÁUSULA SEGUNDA - DO PRAZO
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULA SEGUNDA – DO PRAZO', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    const dataEmprestimo = new Date(emprestimo.data_emprestimo + 'T00:00:00').toLocaleDateString('pt-BR');
    const textoPrazo = emprestimo.data_devolucao_prevista 
      ? `2.1. O prazo do presente comodato iniciou-se em ${dataEmprestimo} e terá prazo até ${new Date(emprestimo.data_devolucao_prevista + 'T00:00:00').toLocaleDateString('pt-BR')}, podendo ser prorrogado mediante acordo entre as partes.`
      : `2.1. O prazo do presente comodato iniciou-se em ${dataEmprestimo} e é por tempo indeterminado, devendo o equipamento ser devolvido quando não mais necessário ou quando solicitado pelo COMODANTE.`;
    
    const linhasPrazo = doc.splitTextToSize(textoPrazo, 180);
    doc.text(linhasPrazo, 15, yPos);
    yPos += linhasPrazo.length * 5 + 8;

    // CLÁUSULA TERCEIRA - OBRIGAÇÕES DO COMODATÁRIO
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULA TERCEIRA – DAS OBRIGAÇÕES DO COMODATÁRIO', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    const obrigacoes = [
      '3.1. Conservar o equipamento em perfeito estado, conforme recebido;',
      '3.2. Utilizar o equipamento de acordo com sua finalidade;',
      '3.3. Não ceder, emprestar ou transferir o equipamento a terceiros;',
      '3.4. Comunicar imediatamente ao COMODANTE qualquer dano, defeito ou necessidade de manutenção;',
      '3.5. Devolver o equipamento nas mesmas condições em que recebeu, ressalvado o desgaste natural pelo uso adequado;',
      '3.6. Zelar pela segurança do equipamento, evitando furto, roubo ou extravio.'
    ];
    
    obrigacoes.forEach(obr => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const linhasObr = doc.splitTextToSize(obr, 180);
      doc.text(linhasObr, 15, yPos);
      yPos += linhasObr.length * 5;
    });
    yPos += 5;

    // CLÁUSULA QUARTA - DA DEVOLUÇÃO
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULA QUARTA – DA DEVOLUÇÃO', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    const textoDevolucao = '4.1. O COMODATÁRIO compromete-se a devolver o equipamento ao COMODANTE imediatamente quando: (a) não mais necessitar do bem; (b) for solicitado pelo COMODANTE; ou (c) findar o prazo estabelecido na Cláusula Segunda.';
    const linhasDevolucao = doc.splitTextToSize(textoDevolucao, 180);
    doc.text(linhasDevolucao, 15, yPos);
    yPos += linhasDevolucao.length * 5 + 8;

    // CLÁUSULA QUINTA - DAS PENALIDADES
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULA QUINTA – DAS PENALIDADES', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    const textoPenalidades = '5.1. Em caso de dano, perda, furto ou roubo do equipamento por culpa do COMODATÁRIO, este se obriga a ressarcir o valor de mercado do bem, sem prejuízo de outras medidas cabíveis.';
    const linhasPenalidades = doc.splitTextToSize(textoPenalidades, 180);
    doc.text(linhasPenalidades, 15, yPos);
    yPos += linhasPenalidades.length * 5 + 8;

    // CLÁUSULA SEXTA - DISPOSIÇÕES GERAIS
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFont('helvetica', 'bold');
    doc.text('CLÁUSULA SEXTA – DISPOSIÇÕES GERAIS', 15, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    
    const textoGeral = '6.1. Este termo pode ser rescindido a qualquer tempo mediante notificação prévia de 3 (três) dias. 6.2. As partes elegem o foro da Comarca de ' + (dadosLoja?.cidade || '') + ' para dirimir quaisquer dúvidas oriundas deste instrumento.';
    const linhasGeral = doc.splitTextToSize(textoGeral, 180);
    doc.text(linhasGeral, 15, yPos);
    yPos += linhasGeral.length * 5 + 10;

    // ========================================
    // ENCERRAMENTO
    // ========================================
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }
    
    const textoEncerramento = 'E por estarem assim justos e contratados, assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença de duas testemunhas.';
    const linhasEncerramento = doc.splitTextToSize(textoEncerramento, 180);
    doc.text(linhasEncerramento, 15, yPos);
    yPos += linhasEncerramento.length * 5 + 15;

    // ========================================
    // LOCAL E DATA
    // ========================================
    const hoje = new Date();
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dataExtenso = `${dadosLoja?.cidade || 'Paranatinga'}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
    
    doc.text(dataExtenso, 105, yPos, { align: 'center' });
    yPos += 15;

    // ========================================
    // ASSINATURAS
    // ========================================
    if (yPos > 220) {
      doc.addPage();
      yPos = 60;
    }

    // COMODANTE
    doc.text('_'.repeat(60), 105, yPos, { align: 'center' });
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('COMODANTE', 105, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(dadosLoja?.nome_loja || 'Loja Maçônica', 105, yPos, { align: 'center' });
    yPos += 3;
    doc.text('Representada por: ____________________________', 105, yPos, { align: 'center' });
    yPos += 15;

    // COMODATÁRIO
    doc.setFontSize(10);
    doc.text('_'.repeat(60), 105, yPos, { align: 'center' });
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('COMODATÁRIO(A)', 105, yPos, { align: 'center' });
    yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(emprestimo.beneficiarios?.nome || '', 105, yPos, { align: 'center' });
    yPos += 3;
    doc.text(`CPF: ${emprestimo.beneficiarios?.cpf || ''}`, 105, yPos, { align: 'center' });
    yPos += 15;

    // RESPONSÁVEL (se houver)
    if (emprestimo.beneficiarios?.responsaveis && emprestimo.beneficiarios.responsaveis.length > 0) {
      const resp = emprestimo.beneficiarios.responsaveis[0];
      doc.setFontSize(10);
      doc.text('_'.repeat(60), 105, yPos, { align: 'center' });
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('RESPONSÁVEL SOLIDÁRIO', 105, yPos, { align: 'center' });
      yPos += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(resp.nome || '', 105, yPos, { align: 'center' });
      yPos += 3;
      doc.text(`CPF: ${resp.cpf || ''}`, 105, yPos, { align: 'center' });
      yPos += 15;
    }

    // TESTEMUNHAS
    yPos += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Testemunhas:', 15, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    
    // Testemunha 1
    doc.text('1. _____________________________________', 15, yPos);
    doc.text('CPF: ____________________', 120, yPos);
    yPos += 10;
    
    // Testemunha 2
    doc.text('2. _____________________________________', 15, yPos);
    doc.text('CPF: ____________________', 120, yPos);

    // ========================================
    // SALVAR PDF
    // ========================================
    const nomeArquivo = `Termo_Comodato_${emprestimo.id}_${emprestimo.beneficiarios?.nome?.replace(/\s+/g, '_')}.pdf`;
    doc.save(nomeArquivo);

    return true;
  } catch (error) {
    console.error('Erro ao gerar termo:', error);
    throw error;
  }
};
