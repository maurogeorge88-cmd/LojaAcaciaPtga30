// ====================================
// ENVIAR ANIVERSARIANTES VIA WHATSAPP
// A∴R∴L∴S∴ Acácia de Paranatinga nº 30
// ====================================

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const qrcode = require('qrcode-terminal');

// ====================================
// CONFIGURAÇÕES
// ====================================
const SUPABASE_URL = 'https://ypnvzjctyfdrkkrhskzs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwbnZ6amN0eWZkcmtrcmhza3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTgxMzcsImV4cCI6MjA3OTMzNDEzN30.J5Jj7wudOhIAxy35DDBIWtr9yr9Lq3ABBRI9ZJ5z2pc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ====================================
// BUSCAR ANIVERSARIANTES DE HOJE
// ====================================
async function buscarAniversariantesHoje() {
  const hoje = new Date();
  const mesHoje = hoje.getMonth();
  const diaHoje = hoje.getDate();
  
  console.log('🎂 Buscando aniversariantes de hoje:', hoje.toLocaleDateString('pt-BR'));
  
  const aniversariantes = [];

  // Buscar IRMÃOS
  const { data: irmaos } = await supabase
    .from('irmaos')
    .select('nome, data_nascimento, telefone, cargo, cim');

  if (irmaos) {
    irmaos.forEach(irmao => {
      if (!irmao.data_nascimento) return;
      
      const dataNasc = new Date(irmao.data_nascimento + 'T00:00:00');
      if (dataNasc.getMonth() === mesHoje && dataNasc.getDate() === diaHoje) {
        const idade = hoje.getFullYear() - dataNasc.getFullYear();
        aniversariantes.push({
          tipo: 'Irmão',
          nome: irmao.nome,
          idade,
          telefone: irmao.telefone,
          cargo: irmao.cargo,
          cim: irmao.cim
        });
      }
    });
  }

  // Buscar ESPOSAS
  const { data: esposas } = await supabase
    .from('esposas')
    .select('nome, data_nascimento, telefone, irmaos(nome, telefone)');

  if (esposas) {
    esposas.forEach(esposa => {
      if (!esposa.data_nascimento) return;
      
      const dataNasc = new Date(esposa.data_nascimento + 'T00:00:00');
      if (dataNasc.getMonth() === mesHoje && dataNasc.getDate() === diaHoje) {
        const idade = hoje.getFullYear() - dataNasc.getFullYear();
        aniversariantes.push({
          tipo: 'Esposa',
          nome: esposa.nome,
          idade,
          irmao_nome: esposa.irmaos?.nome,
          irmao_telefone: esposa.irmaos?.telefone
        });
      }
    });
  }

  // Buscar FILHOS
  const { data: filhos } = await supabase
    .from('filhos')
    .select('nome, data_nascimento, irmaos(nome, telefone)');

  if (filhos) {
    filhos.forEach(filho => {
      if (!filho.data_nascimento) return;
      
      const dataNasc = new Date(filho.data_nascimento + 'T00:00:00');
      if (dataNasc.getMonth() === mesHoje && dataNasc.getDate() === diaHoje) {
        const idade = hoje.getFullYear() - dataNasc.getFullYear();
        aniversariantes.push({
          tipo: 'Filho(a)',
          nome: filho.nome,
          idade,
          irmao_nome: filho.irmaos?.nome,
          irmao_telefone: filho.irmaos?.telefone
        });
      }
    });
  }

  console.log(`✅ Encontrados ${aniversariantes.length} aniversariantes`);
  return aniversariantes;
}

// ====================================
// BUSCAR RESPONSÁVEIS
// ====================================
async function buscarResponsaveis() {
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('nome, email, tipo, irmaos(telefone, cargo)')
    .or('tipo.eq.administrador,irmaos.cargo.eq.Chanceler,irmaos.cargo.eq.Venerável,irmaos.cargo.eq.Secretário');

  const responsaveis = [];
  
  if (usuarios) {
    usuarios.forEach(user => {
      if (user.irmaos?.telefone) {
        responsaveis.push({
          nome: user.nome,
          telefone: user.irmaos.telefone,
          cargo: user.irmaos.cargo || user.tipo
        });
      }
    });
  }

  console.log(`✅ Encontrados ${responsaveis.length} responsáveis`);
  return responsaveis;
}

// ====================================
// MONTAR MENSAGEM
// ====================================
function montarMensagemParaIrmao(aniversariante) {
  return `🎂 *FELIZ ANIVERSÁRIO!* 🎉

✨ *${aniversariante.nome}*

Hoje você completa *${aniversariante.idade} anos*!

Que este novo ano de vida seja repleto de:
• 🌟 Saúde e paz
• 💪 Força e sabedoria
• 🙏 Luz e prosperidade

A família maçônica da *A∴R∴L∴S∴ Acácia de Paranatinga nº 30* deseja-lhe muitas felicidades!

🔺🔻🔺 *T∴F∴A∴* 🔺🔻🔺`;
}

function montarMensagemParaResponsaveis(aniversariantes) {
  let mensagem = `🎂 *ANIVERSARIANTES HOJE!*\n`;
  mensagem += `📅 ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}\n\n`;

  if (aniversariantes.length === 0) {
    mensagem += `Nenhum aniversariante hoje.\n\n`;
  } else {
    aniversariantes.forEach((aniv, index) => {
      mensagem += `${index + 1}. *${aniv.nome}*\n`;
      mensagem += `   📋 ${aniv.tipo} - ${aniv.idade} anos\n`;
      
      if (aniv.cim) {
        mensagem += `   🔹 CIM: ${aniv.cim}\n`;
      }
      
      if (aniv.cargo) {
        mensagem += `   👔 ${aniv.cargo}\n`;
      }
      
      if (aniv.irmao_nome) {
        mensagem += `   👤 Irmão: ${aniv.irmao_nome}\n`;
      }
      
      mensagem += `\n`;
    });
  }

  mensagem += `💐 Não esqueça de cumprimentar!\n\n`;
  mensagem += `🔺🔻🔺 *A∴R∴L∴S∴ Acácia de Paranatinga nº 30*`;

  return mensagem;
}

// ====================================
// FORMATAR NÚMERO DE TELEFONE
// ====================================
function formatarTelefone(telefone) {
  if (!telefone) return null;
  
  // Remove tudo que não é número
  let numero = telefone.replace(/\D/g, '');
  
  // Se não tem código do país, adiciona 55 (Brasil)
  if (!numero.startsWith('55')) {
    numero = '55' + numero;
  }
  
  // Adiciona @s.whatsapp.net
  return numero + '@s.whatsapp.net';
}

// ====================================
// CONECTAR WHATSAPP
// ====================================
async function conectarWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📱 Escaneie o QR Code com seu WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Conexão fechada. Reconectando?', shouldReconnect);
      
      if (shouldReconnect) {
        conectarWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp conectado!');
      enviarNotificacoes(sock);
    }
  });

  return sock;
}

// ====================================
// ENVIAR NOTIFICAÇÕES
// ====================================
async function enviarNotificacoes(sock) {
  try {
    console.log('\n🚀 Iniciando envio de notificações...\n');

    // Buscar dados
    const aniversariantes = await buscarAniversariantesHoje();
    const responsaveis = await buscarResponsaveis();

    if (aniversariantes.length === 0) {
      console.log('ℹ️ Nenhum aniversariante hoje. Enviando aviso aos responsáveis...');
    }

    // 1. ENVIAR PARA OS ANIVERSARIANTES (IRMÃOS)
    for (const aniv of aniversariantes) {
      if (aniv.tipo === 'Irmão' && aniv.telefone) {
        const numeroFormatado = formatarTelefone(aniv.telefone);
        if (numeroFormatado) {
          const mensagem = montarMensagemParaIrmao(aniv);
          
          console.log(`📤 Enviando para ${aniv.nome} (${numeroFormatado})...`);
          
          await sock.sendMessage(numeroFormatado, { text: mensagem });
          console.log(`✅ Enviado para ${aniv.nome}!`);
          
          // Aguardar 2 segundos entre mensagens
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // 2. ENVIAR PARA RESPONSÁVEIS (CHANCELER, VENERÁVEL, ADMINISTRADOR)
    const mensagemResponsaveis = montarMensagemParaResponsaveis(aniversariantes);
    
    for (const resp of responsaveis) {
      const numeroFormatado = formatarTelefone(resp.telefone);
      if (numeroFormatado) {
        console.log(`📤 Enviando relatório para ${resp.nome} (${resp.cargo})...`);
        
        await sock.sendMessage(numeroFormatado, { text: mensagemResponsaveis });
        console.log(`✅ Enviado para ${resp.nome}!`);
        
        // Aguardar 2 segundos entre mensagens
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎉 Todas as mensagens foram enviadas!\n');
    
    // Desconectar após 5 segundos
    setTimeout(() => {
      console.log('👋 Desconectando...');
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ Erro ao enviar notificações:', error);
    process.exit(1);
  }
}

// ====================================
// INICIAR
// ====================================
console.log('╔════════════════════════════════════════════╗');
console.log('║  🎂 BOT ANIVERSARIANTES - WHATSAPP       ║');
console.log('║  A∴R∴L∴S∴ Acácia de Paranatinga nº 30    ║');
console.log('╚════════════════════════════════════════════╝\n');

conectarWhatsApp();
