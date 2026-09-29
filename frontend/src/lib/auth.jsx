import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

/** Panel que le corresponde a cada rol. */
export function rutaPorRol(rol) {
  if (rol === 'ADMIN') return '/admin';
  if (rol === 'SUPERVISOR') return '/supervision';
  return '/panel';
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarPerfil = useCallback(async () => {
    const token = localStorage.getItem('omasur_token');
    if (!token) {
      setUsuario(null);
      setCargando(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/perfil');
      setUsuario(data);
    } catch {
      localStorage.removeItem('omasur_token');
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarPerfil();
  }, [cargarPerfil]);

  const guardarSesion = useCallback(
    async (token) => {
      localStorage.setItem('omasur_token', token);
      setCargando(true);
      await cargarPerfil();
    },
    [cargarPerfil],
  );

  const salir = useCallback(() => {
    localStorage.removeItem('omasur_token');
    setUsuario(null);
  }, []);

  const valor = useMemo(
    () => ({ usuario, cargando, guardarSesion, salir, recargar: cargarPerfil }),
    [usuario, cargando, guardarSesion, salir, cargarPerfil],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return contexto;
}
