import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function VisualizarAltosGraus() {
  const [irmaosComGraus, setIrmaosComGraus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroRito, setFiltroRito] = useState('');
  const [irmaoSelecionado, setIrmaoSelecionado] = useState(null);

  useEffect(() => {
    carregarIrmaosComGraus();
  }, []);

  const carregarIrmaosComGraus = async () => {
    setLoading(true);

    const { data: grausData } = await supabase
      .from('vida_maconica')
      .select(`
        *,
        irmao:irmaos(id, nome, cim),
        grau:graus_maconicos(*)
      `)
      .order('irmao_id');

    if (grausData) {
      const irmaosMap = {};
      
      grausData.forEach(item => {
        if (!irmaosMap[item.irmao_id]) {
          irmaosMap[item.irmao_id] = {
            irmao: item.irmao,
            graus: []
          };
        }
        irmaosMap[item.irmao_id].graus.push({
          ...item.grau,
          data_conquista: item.data_conquista,
          loja_conferente: item.loja_conferente,
          oriente_conferente: item.oriente_conferente
        });
      });

      Object.values(irmaosMap).forEach(irmaoData => {
        const grausPorRito = {};
        irmaoData.graus.forEach(grau => {
          if (!grausPorRito[grau.rito]) {
            grausPorRito[grau.rito] = [];
          }
          grausPorRito[grau.rito].push(grau);
        });

        Object.keys(grausPorRito).forEach(rito => {
          grausPorRito[rito].sort((a, b) => a.numero_grau - b.numero_grau);
        });

        irmaoData.grausPorRito = grausPorRito;
      });

      setIrmaosComGraus(Object.values(irmaosMap));
    }

    setLoading(false);
  };

  const irmaosFiltrados = filtroRito
    ? irmaosComGraus.filter(i => i.grausPorRito[filtroRito])
    : irmaosComGraus;

  const ritos = [...new Set(irmaosComGraus.flatMap(i => Object.keys(i.grausPorRito)))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl" style={{color:"var(--color-text-muted)"}}>Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{background:"var(--color-bg)",minHeight:"100vh",padding:"0.75rem",overflowX:"hidden"}}>
      <div className="rounded-lg p-6 text-white" style={{background:"var(--color-accent)"}}>
        <h2 style={{fontSize:"1.75rem",fontWeight:"800",color:"#fff",margin:"0 0 0.25rem"}}>🔺 Altos Graus Maçônicos</h2>
        <p style={{color:"rgba(255,255,255,0.85)",fontSize:"0.9rem"}}>Irmãos com graus filosóficos conquistados</p>
      </div>

      <div className="rounded-lg shadow p-4" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1" style={{color:"var(--color-text-muted)"}}>Filtrar por Rito</label>
            <select
              value={filtroRito}
              onChange={(e) => setFiltroRito(e.target.value)}
              style={{width:"100%",padding:"0.5rem 0.75rem",borderRadius:"var(--radius-lg)",background:"var(--color-surface-2)",color:"var(--color-text)",border:"1px solid var(--color-border)"}}
            >
              <option value="">Todos os Ritos</option>
              {ritos.map(rito => (
                <option key={rito} value={rito}>{rito}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm" style={{color:"var(--color-text-muted)"}}>
              <strong>{irmaosFiltrados.length}</strong> irmãos encontrados
            </div>
          </div>
        </div>
      </div>

      {irmaosFiltrados.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          {irmaosFiltrados.map((irmaoData) => (
            <div key={irmaoData.irmao.id} className="rounded-lg border-l-4 overflow-hidden transition-opacity hover:opacity-90" style={{borderLeftColor:"var(--color-accent)",background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
              <div style={{padding:"1rem",background:"var(--color-surface-2)",borderBottom:"1px solid var(--color-border)"}}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-indigo-900" style={{color:"var(--color-text)"}}>{irmaoData.irmao.nome}</h3>
                    <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)"}}>CIM: {irmaoData.irmao.cim}</p>
                  </div>
                  <div className="text-right">
                    <div style={{fontSize:"1.5rem",fontWeight:"800",color:"var(--color-accent)"}}>{irmaoData.graus.length + 3}</div>
                    <div style={{fontSize:"0.72rem",color:"var(--color-text-muted)",textAlign:"right",lineHeight:"1.5"}}>
                      {irmaoData.graus.length + 3 === 1 ? 'grau' : 'graus'}
                      <br />
                      <span>({irmaoData.graus.length} altos + 3 simbólicos)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {Object.entries(irmaoData.grausPorRito).map(([rito, graus]) => (
                  <div key={rito} className="space-y-2">
                    <div className="flex items-center gap-2 mb-3">
                      <div style={{fontSize:"1rem",fontWeight:"700",color:"var(--color-text)"}}>{rito}</div>
                      <div style={{flex:1,height:"1px",background:"var(--color-border)"}}></div>
                      <div style={{fontSize:"0.78rem",color:"var(--color-text-muted)"}}>{graus.length} {graus.length === 1 ? 'grau' : 'graus'}</div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {graus.map((grau) => (
                        <div
                          key={grau.numero_grau}
                          className="group relative rounded-lg p-3 transition-all cursor-pointer overflow-hidden" style={{background:"var(--color-accent)",color:"#fff"}}
                          onClick={() => setIrmaoSelecionado({ irmao: irmaoData.irmao, grau})}
                        >
                          {grau.imagem_url ? (
                            <div className="flex flex-col items-center">
                              <img 
                                src={grau.imagem_url} 
                                alt={grau.nome_grau}
                                className="w-20 h-20 object-contain mb-1"
                              />
                              <div className="text-xl font-bold">{grau.numero_grau}º</div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="text-2xl font-bold mb-1">{grau.numero_grau}º</div>
                              <div className="text-xs leading-tight">{grau.nome_grau}</div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-lg border-2 border-dashed" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
          <div className="text-6xl mb-4">🔺</div>
          <p style={{fontSize:"1rem",fontWeight:"600",color:"var(--color-text)"}}>Nenhum irmão com graus filosóficos cadastrados</p>
          <p style={{fontSize:"0.85rem",color:"var(--color-text-muted)",marginTop:"0.5rem"}}>
            {filtroRito ? `Nenhum grau do rito ${filtroRito} encontrado` : 'Cadastre graus no perfil dos irmãos'}
          </p>
        </div>
      )}

      {irmaoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg max-w-md w-full p-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{fontSize:"1.1rem",fontWeight:"700",color:"var(--color-text)",margin:0}}>Detalhes do Grau</h3>
              <button onClick={() => setIrmaoSelecionado(null)} style={{background:"var(--color-surface-2)",border:"1px solid var(--color-border)",color:"var(--color-text)",borderRadius:"50%",width:"2rem",height:"2rem",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"1rem",fontWeight:"700"}}>×</button>
            </div>

            <div className="space-y-3">
              <div>
                <p style={{fontSize:"0.75rem",color:"var(--color-text-muted)",marginBottom:"0.2rem"}}>Irmão</p>
                <p style={{fontWeight:"600",color:"var(--color-text)"}}>{irmaoSelecionado.irmao.nome}</p>
                <p style={{fontSize:"0.72rem",color:"var(--color-text-muted)"}}>CIM: {irmaoSelecionado.irmao.cim}</p>
              </div>

              <div style={{borderTop:"1px solid var(--color-border)",paddingTop:"0.75rem"}}>
                <p style={{fontSize:"1.875rem",fontWeight:"800",color:"var(--color-accent)",marginBottom:"0.5rem"}}>{irmaoSelecionado.grau.numero_grau}º Grau</p>
                <p style={{fontSize:"1.05rem",fontWeight:"700",color:"var(--color-text)"}}>{irmaoSelecionado.grau.nome_grau}</p>
                <p style={{fontSize:"0.82rem",color:"var(--color-text-muted)",marginTop:"0.25rem"}}>Rito: {irmaoSelecionado.grau.rito}</p>
              </div>

              {irmaoSelecionado.grau.data_conquista && (
                <div>
                  <p style={{fontSize:"0.75rem",color:"var(--color-text-muted)",marginBottom:"0.2rem"}}>Data de Conquista</p>
                  <p style={{fontWeight:"600",color:"var(--color-text)"}}>{irmaoSelecionado.grau.data_conquista.split('-').reverse().join('/')}</p>
                </div>
              )}

              {irmaoSelecionado.grau.loja_conferente && (
                <div>
                  <p style={{fontSize:"0.75rem",color:"var(--color-text-muted)",marginBottom:"0.2rem"}}>Loja Conferente</p>
                  <p style={{fontWeight:"600",color:"var(--color-text)"}}>{irmaoSelecionado.grau.loja_conferente}</p>
                </div>
              )}

              {irmaoSelecionado.grau.oriente_conferente && (
                <div>
                  <p style={{fontSize:"0.75rem",color:"var(--color-text-muted)",marginBottom:"0.2rem"}}>Oriente</p>
                  <p style={{fontWeight:"600",color:"var(--color-text)"}}>{irmaoSelecionado.grau.oriente_conferente}</p>
                </div>
              )}

              {irmaoSelecionado.grau.descricao && (
                <div>
                  <p style={{fontSize:"0.75rem",color:"var(--color-text-muted)",marginBottom:"0.2rem"}}>Descrição</p>
                  <p style={{fontSize:"0.85rem",fontStyle:"italic",color:"var(--color-text-muted)"}}>{irmaoSelecionado.grau.descricao}</p>
                </div>
              )}
            </div>

            <button onClick={() => setIrmaoSelecionado(null)} style={{marginTop:"1.5rem",width:"100%",padding:"0.5rem 1rem",background:"var(--color-accent)",color:"#fff",border:"none",borderRadius:"var(--radius-lg)",cursor:"pointer",fontWeight:"600"}}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
