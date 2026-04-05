import React from 'react';

export default function ModalBase({ 
  aberto, 
  onFechar, 
  titulo, 
  corHeader = '',
  tamanho = 'lg', 
  children 
}) {
  if (!aberto) return null;

  const tamanhos = {
    sm:  'max-w-sm',
    md:  'max-w-md',
    lg:  'max-w-lg',
    xl:  'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  const headerBg = corHeader || 'var(--color-accent)';
  // Se corHeader é uma classe Tailwind (bg-*), manter como className
  const usaClassHeader = corHeader.startsWith('bg-') || corHeader.startsWith('from-');

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:'1rem'}}>
      <div
        className={tamanhos[tamanho]}
        style={{
          width:'100%',
          maxHeight:'90vh',
          overflowY:'auto',
          background:'var(--color-surface)',
          border:'1px solid var(--color-border)',
          borderRadius:'var(--radius-xl)',
          boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className={usaClassHeader ? corHeader : ''}
          style={{
            position:'sticky',
            top:0,
            zIndex:10,
            ...(!usaClassHeader ? {background: headerBg === '' ? 'var(--color-surface-2)' : headerBg} : {}),
            padding:'1rem 1.5rem',
            display:'flex',
            justifyContent:'space-between',
            alignItems:'center',
            borderBottom:'1px solid var(--color-border)',
            borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',
          }}
        >
          <h3 style={{fontSize:'1.1rem',fontWeight:'700',color:'#fff',margin:0}}>{titulo}</h3>
          <button
            onClick={onFechar}
            type="button"
            style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',borderRadius:'50%',width:'2rem',height:'2rem',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}
          >
            <svg style={{width:'1rem',height:'1rem'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{padding:'1.5rem'}}>
          {children}
        </div>
      </div>
    </div>
  );
}
