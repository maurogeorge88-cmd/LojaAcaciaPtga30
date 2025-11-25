import { useState } from 'react';

const QuadroIrmaos = ({ irmaos }) => {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">Quadro de Irmãos</h2>
      <p>Total: {irmaos.length} irmãos</p>
    </div>
  );
};

export default QuadroIrmaos;
