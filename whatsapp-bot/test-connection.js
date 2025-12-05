// ====================================
// TESTE DE CONEXÃO - WHATSAPP
// ====================================

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

async function testarConexao() {
  console.log('🔌 Testando conexão WhatsApp...\n');

  const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    
    if (qr) {
      console.log('📱 Escaneie este QR Code:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'open') {
      console.log('\n✅ WhatsApp conectado com sucesso!');
      console.log('👍 Você pode fechar agora. Use: npm start\n');
      
      setTimeout(() => {
        process.exit(0);
      }, 3000);
    }
  });
}

testarConexao();
