import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ParticipacaoComissoes = () => {
  const [aba, setAba] = useState('irmao');
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Buscar integrantes
      const { data: integrantes, error: errorIntegrantes } = await supabase
        .from('comissoes_integrantes')
        .select('funcao, comissao_id, irmao_id');

      if (errorIntegrantes) throw errorIntegrantes;
      if (!integrantes || integrantes.length === 0) {
        setDados([]);
        setLoading(false);
        return;
      }

      // Buscar comissões em andamento
      const { data: comissoes, error: errorComissoes } = await supabase
        .from('comissoes')
        .select('id, nome, status, origem')
        .eq('status', 'em_andamento');

      if (errorComissoes) throw errorComissoes;

      // Buscar irmãos regulares
      const { data: irmaos, error: errorIrmaos } = await supabase
        .from('irmaos')
        .select('id, nome, cim, situacao')
        .eq('situacao', 'regular');

      if (errorIrmaos) throw errorIrmaos;

      // Fazer o join manual
      const dadosCompletos = integrantes
        .map(integrante => {
          const comissao = comissoes?.find(c => c.id === integrante.comissao_id);
          const irmao = irmaos?.find(i => i.id === integrante.irmao_id);
          
          if (!comissao || !irmao) return null;
          
          return {
            funcao: integrante.funcao,
            comissoes: comissao,
            irmaos: irmao
          };
        })
        .filter(item => item !== null);

      setDados(dadosCompletos);
    } catch (error) {
      console.error('Erro ao carregar participações:', error);
    } finally {
      setLoading(false);
    }
  };

  const agruparPorIrmao = () => {
    const grupos = {};
    
    dados.forEach(item => {
      const irmaoId = item.irmaos.id;
      
      if (!grupos[irmaoId]) {
        grupos[irmaoId] = {
          nome: item.irmaos.nome,
          cim: item.irmaos.cim,
          comissoes: []
        };
      }
      
      grupos[irmaoId].comissoes.push({
        nome: item.comissoes.nome,
        funcao: item.funcao,
        origem: item.comissoes.origem
      });
    });
    
    return Object.values(grupos).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const agruparPorComissao = () => {
    const grupos = {};
    
    dados.forEach(item => {
      const comissaoId = item.comissoes.id;
      
      if (!grupos[comissaoId]) {
        grupos[comissaoId] = {
          nome: item.comissoes.nome,
          status: item.comissoes.status,
          origem: item.comissoes.origem,
          integrantes: []
        };
      }
      
      grupos[comissaoId].integrantes.push({
        nome: item.irmaos.nome,
        cim: item.irmaos.cim,
        funcao: item.funcao
      });
    });
    
    Object.values(grupos).forEach(grupo => {
      const ordemFuncao = {
        'Presidente': 1,
        'Vice-Presidente': 2,
        'Secretário': 3,
        'Tesoureiro': 4,
        'Membro': 5
      };
      
      grupo.integrantes.sort((a, b) => {
        const ordemA = ordemFuncao[a.funcao] || 999;
        const ordemB = ordemFuncao[b.funcao] || 999;
        return ordemA - ordemB;
      });
    });
    
    return Object.values(grupos).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const getBadgeFuncao = (funcao) => {
    const estilos = {
      'Presidente':      {background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)'},
      'Vice-Presidente': {background:'rgba(59,130,246,0.15)',color:'#3b82f6',border:'1px solid rgba(59,130,246,0.3)'},
      'Secretário':      {background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'},
      'Tesoureiro':      {background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)'},
      'Membro':          {background:'var(--color-surface-2)',color:'var(--color-text-muted)',border:'1px solid var(--color-border)'},
    };
    const icones = {
      'Presidente': '👑', 'Vice-Presidente': '📋', 'Secretário': '📝',
      'Tesoureiro': '💰', 'Membro': '👤'
    };
    const s = estilos[funcao] || estilos['Membro'];
    return (
      <span style={{...s,padding:'0.1rem 0.45rem',borderRadius:'var(--radius-sm)',fontSize:'0.7rem',fontWeight:'700',whiteSpace:'nowrap'}}>
        {icones[funcao] || '👤'} {funcao}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="rounded-lg shadow p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <p style={{textAlign:"center",color:"var(--color-text-muted)"}}>⏳ Carregando participações...</p>
      </div>
    );
  }

  const porIrmao = agruparPorIrmao();
  const porComissao = agruparPorComissao();

  if (dados.length === 0) {
    return (
      <div className="rounded-lg shadow p-6 mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
        <h3 className="text-lg font-bold mb-2" style={{color:"var(--color-text)"}}>📋 Participação em Comissões</h3>
        <p style={{textAlign:"center",padding:"1rem",color:"var(--color-text-muted)"}}>Nenhuma participação em comissões ativas</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden mb-6" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
      <div style={{background:"var(--color-accent)",padding:"1rem 1.25rem"}}>
        <h3 style={{fontSize:"1rem",fontWeight:"700",color:"#fff",marginBottom:"0.75rem"}}>📋 Participação em Comissões</h3>
        
        <div className="flex gap-2">
          <button
            onClick={() => setAba('irmao')}
            style={{padding:'0.4rem 1rem',borderRadius:'var(--radius-md)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.15s',background:aba==='irmao'?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.15)',color:aba==='irmao'?'var(--color-accent)':'#fff'}}
          >
            👥 Por Irmão ({porIrmao.length})
          </button>
          <button
            onClick={() => setAba('comissao')}
            style={{padding:'0.4rem 1rem',borderRadius:'var(--radius-md)',fontWeight:'600',cursor:'pointer',border:'none',transition:'all 0.15s',background:aba==='comissao'?'rgba(255,255,255,0.95)':'rgba(255,255,255,0.15)',color:aba==='comissao'?'var(--color-accent)':'#fff'}}
          >
            📊 Por Comissão ({porComissao.length})
          </button>
        </div>
      </div>

      <div style={{padding:"1rem",background:"var(--color-bg)"}}>
        {aba === 'irmao' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {porIrmao.map((irmao, index) => (
              <div key={index} className="border rounded-lg p-3 hover: transition" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-2xl">👤</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate" style={{color:"var(--color-text)"}} title={irmao.nome}>{irmao.nome}</h4>
                    <p style={{fontSize:"0.72rem",color:"var(--color-text-muted)"}}>CIM {irmao.cim}</p>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  {irmao.comissoes.map((com, idx) => (
                    <div key={idx} style={{padding:"0.35rem 0.5rem",borderRadius:"var(--radius-sm)",borderLeft:"2px solid var(--color-accent)",background:"var(--color-surface-2)"}}>
                      <p style={{fontSize:"0.72rem",fontWeight:"600",color:"var(--color-text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={com.nome}>{com.nome}</p>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {getBadgeFuncao(com.funcao)}
                        <span style={{fontSize:"0.65rem",padding:"0.1rem 0.4rem",borderRadius:"var(--radius-sm)",background:com.origem==='interna'?'rgba(59,130,246,0.15)':'rgba(139,92,246,0.15)',color:com.origem==='interna'?'#3b82f6':'#8b5cf6'}}>
                          {com.origem === 'interna' ? '🏛️' : '🌐'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {porComissao.map((comissao, index) => (
              <div key={index} className="border rounded-lg overflow-hidden" style={{background:"var(--color-surface)",border:"1px solid var(--color-border)"}}>
                <div style={{padding:"0.75rem",borderLeft:comissao.origem==='interna'?'4px solid #3b82f6':'4px solid #8b5cf6',background:comissao.origem==='interna'?'rgba(59,130,246,0.08)':'rgba(139,92,246,0.08)'}}>
                  <h4 className="font-bold text-sm mb-2" style={{color:"var(--color-text)"}} title={comissao.nome}>{comissao.nome}</h4>
                  <div className="flex gap-1.5 flex-wrap">
                    <span style={{padding:"0.1rem 0.5rem",borderRadius:"999px",fontSize:"0.68rem",fontWeight:"700",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid rgba(16,185,129,0.3)"}}>
                      🟢 Em Andamento
                    </span>
                    <span style={{padding:'0.1rem 0.5rem',borderRadius:'999px',fontSize:'0.68rem',fontWeight:'700',background:comissao.origem==='interna'?'rgba(59,130,246,0.15)':'rgba(139,92,246,0.15)',color:comissao.origem==='interna'?'#3b82f6':'#8b5cf6',border:`1px solid ${comissao.origem==='interna'?'rgba(59,130,246,0.3)':'rgba(139,92,246,0.3)'}`}}>
                      {comissao.origem === 'interna' ? '🏛️ Interna' : '🌐 Externa'}
                    </span>
                  </div>
                </div>
                
                <div className="p-3">
                  <p style={{fontSize:"0.65rem",fontWeight:"700",color:"var(--color-text-muted)",marginBottom:"0.5rem",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                    INTEGRANTES ({comissao.integrantes.length})
                  </p>
                  <div className="space-y-2">
                    {comissao.integrantes.map((integrante, idx) => (
                      <div key={idx} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.4rem 0.5rem",borderRadius:"var(--radius-sm)",background:"var(--color-surface-2)",border:"1px solid var(--color-border)"}}>
                        <div className="min-w-0 flex-1">
                          <p style={{fontWeight:"600",fontSize:"0.78rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:"var(--color-text)"}} title={integrante.nome}>{integrante.nome}</p>
                          <p style={{fontSize:"0.65rem",color:"var(--color-text-muted)"}}>CIM {integrante.cim}</p>
                        </div>
                        <div className="ml-2">
                          {getBadgeFuncao(integrante.funcao)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipacaoComissoes;
