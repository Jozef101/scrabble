import { useState, useCallback } from 'react';

// Vlastný hook na správu "toast" notifikácií
export function useToast() {
  // Stav, ktorý drží pole všetkých aktuálne zobrazených notifikácií
  const [toasts, setToasts] = useState([]);

  // Funkcia na pridanie novej notifikácie do zoznamu
  // Používame useCallback, aby sa funkcia zbytočne nevytvárala nanovo pri každom renderovaní
  const addToast = useCallback((message, type = 'info') => {
    // Vytvoríme nový objekt notifikácie s unikátnym ID (na základe času)
    const newToast = {
      id: Date.now() + Math.random(),
      message,
      type,
    };
    // Pridáme novú notifikáciu na koniec poľa
    setToasts(prevToasts => [...prevToasts, newToast]);
  }, []);

  // Funkcia na odstránenie notifikácie zo zoznamu (volá sa po jej zmiznutí)
  const dismissToast = useCallback((id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // Hook vráti zoznam notifikácií a funkcie na ich správu
  return { toasts, addToast, dismissToast };
}
