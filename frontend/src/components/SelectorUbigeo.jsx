import { DEPARTAMENTOS, distritosDe, provinciasDe } from '../lib/datos';
import { Selector } from './Ui.jsx';

/**
 * Departamento → provincia → distrito. Todo se elige de listas, nunca se escribe.
 * `valores` y `alCambiar` trabajan sobre { departamento, provincia, distrito }.
 */
export default function SelectorUbigeo({ valores, alCambiar, requerido = true }) {
  const { departamento, provincia, distrito } = valores;

  const elegirDepartamento = (evento) =>
    alCambiar({ departamento: evento.target.value, provincia: '', distrito: '' });

  const elegirProvincia = (evento) =>
    alCambiar({ departamento, provincia: evento.target.value, distrito: '' });

  const elegirDistrito = (evento) =>
    alCambiar({ departamento, provincia, distrito: evento.target.value });

  return (
    <>
      <Selector
        etiqueta="Departamento"
        required={requerido}
        value={departamento}
        onChange={elegirDepartamento}
      >
        <option value="">Seleccione</option>
        {DEPARTAMENTOS.map((nombre) => (
          <option key={nombre} value={nombre}>
            {nombre}
          </option>
        ))}
      </Selector>

      <Selector
        etiqueta="Provincia"
        required={requerido}
        value={provincia}
        onChange={elegirProvincia}
        disabled={!departamento}
      >
        <option value="">{departamento ? 'Seleccione' : 'Elija un departamento'}</option>
        {provinciasDe(departamento).map((nombre) => (
          <option key={nombre} value={nombre}>
            {nombre}
          </option>
        ))}
      </Selector>

      <Selector
        etiqueta="Distrito"
        required={requerido}
        value={distrito}
        onChange={elegirDistrito}
        disabled={!provincia}
      >
        <option value="">{provincia ? 'Seleccione' : 'Elija una provincia'}</option>
        {distritosDe(departamento, provincia).map((nombre) => (
          <option key={nombre} value={nombre}>
            {nombre}
          </option>
        ))}
      </Selector>
    </>
  );
}
