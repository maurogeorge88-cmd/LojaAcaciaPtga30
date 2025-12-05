// ====================================
// AGENDADOR DIÁRIO - WHATSAPP
// Executa todo dia às 8h da manhã
// ====================================

const cron = require('node-cron');
const { exec } = require('child_process');

console.log('╔════════════════════════════════════════════╗');
console.log('║  ⏰ AGENDADOR ANIVERSARIANTES             ║');
console.log('║  Executa todo dia às 8h da manhã          ║');
console.log('╚════════════════════════════════════════════╝\n');

// Agendar para 8h da manhã (0 8 * * *)
// Formato: segundo minuto hora dia mês dia-semana
cron.schedule('0 8 * * *', () => {
  const agora = new Date();
  console.log(`\n🕐 ${agora.toLocaleString('pt-BR')} - Executando envio...\n`);
  
  exec('node enviar-aniversariantes.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Erro: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`⚠️ Stderr: ${stderr}`);
      return;
    }
    console.log(stdout);
  });
}, {
  timezone: "America/Cuiaba" // Mato Grosso
});

console.log('✅ Agendador iniciado!');
console.log('📅 Próxima execução: Todo dia às 8h da manhã');
console.log('🌍 Timezone: America/Cuiaba (Mato Grosso)\n');
console.log('💡 Para testar agora: npm start\n');
console.log('⏹️  Para parar: Ctrl+C\n');

// Manter rodando
setInterval(() => {}, 1000);
