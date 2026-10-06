// Campo obrigatório "União estável" (Sim/Não), complemento do estado civil.
// Para Casado não se aplica (fica desabilitado e gravado como null).
export default function CampoUniaoEstavel({ estadoCivil, valor, onChange, className, style }) {
  const casado = estadoCivil === 'casado';
  const v = valor === true ? 'sim' : valor === false ? 'nao' : '';
  return (
    <select
      value={casado ? '' : v}
      disabled={casado}
      onChange={(e) => onChange(e.target.value === 'sim' ? true : e.target.value === 'nao' ? false : null)}
      className={className}
      style={{ ...style, borderColor: !casado && v === '' ? '#ef4444' : style?.borderColor }}
    >
      <option value="">{casado ? 'Não se aplica (casado)' : 'Selecione... *'}</option>
      <option value="sim">Sim — convivente em união estável</option>
      <option value="nao">Não — não convivente em união estável</option>
    </select>
  );
}
