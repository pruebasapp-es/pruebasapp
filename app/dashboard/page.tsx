'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface PendingLog {
  type: string;
  lat: number;
  lng: number;
  recorded_at: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState('Listo para fichar')
  const [isOffline, setIsOffline] = useState(false)
  
  useEffect(() => {
    // Detectar conexión y sincronizar pendientes
    const handleOnline = () => {
      setIsOffline(false);
      syncPendingLogs();
    }
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setIsOffline(true);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }, [])

  const syncPendingLogs = async () => {
    const pending = JSON.parse(localStorage.getItem('pendingLogs') || '[]');
    if (pending.length === 0) return;

    setStatus(`Sincronizando ${pending.length} fichajes offline...`);
    const remaining = [];

    for (const log of pending) {
      try {
        const res = await fetch('/api/fichar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log)
        });
        if (!res.ok) remaining.push(log);
      } catch {
        remaining.push(log);
      }
    }
    localStorage.setItem('pendingLogs', JSON.stringify(remaining));
    setStatus(remaining.length === 0 ? 'Sincronización completada' : 'Quedan pendientes');
  }

  const handleFichar = (type: 'check-in' | 'check-out') => {
    setStatus('Obteniendo GPS...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const payload: PendingLog = {
          type,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          recorded_at: new Date().toISOString()
        };

        if (!navigator.onLine) {
          // Guardado OFFLINE
          const pending = JSON.parse(localStorage.getItem('pendingLogs') || '[]');
          pending.push(payload);
          localStorage.setItem('pendingLogs', JSON.stringify(pending));
          setStatus(`Fichaje guardado OFFLINE (${type})`);
          return;
        }

        // Guardado ONLINE
        setStatus('Enviando...');
        try {
          const res = await fetch('/api/fichar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) setStatus(`Fichaje de ${type} correcto.`);
          else throw new Error('Error API');
        } catch (error) {
           // Si falla la red durante el fetch, guardar offline
           const pending = JSON.parse(localStorage.getItem('pendingLogs') || '[]');
           pending.push(payload);
           localStorage.setItem('pendingLogs', JSON.stringify(pending));
           setStatus(`Error de red. Guardado OFFLINE.`);
        }
      },
      (error) => setStatus(`Error GPS: ${error.message}`),
      { enableHighAccuracy: true }
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      {isOffline && <div className="bg-yellow-100 text-yellow-800 p-2 rounded w-full max-w-sm text-center">Modo Sin Conexión Activado</div>}
      
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm flex flex-col gap-4 items-center">
        <h2 className="text-xl font-bold">Panel de Fichaje</h2>
        <div className="flex gap-4 w-full">
          <button onClick={() => handleFichar('check-in')} className="flex-1 bg-green-600 text-white py-4 rounded font-bold">Entrada</button>
          <button onClick={() => handleFichar('check-out')} className="flex-1 bg-gray-800 text-white py-4 rounded font-bold">Salida</button>
        </div>
        <p className="text-sm font-medium mt-4 text-center">{status}</p>
      </div>
    </div>
  )
}
