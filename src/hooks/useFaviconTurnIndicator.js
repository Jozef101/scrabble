// src/hooks/useFaviconTurnIndicator.js
import { useEffect, useRef } from 'react';

const ORIGINAL_FAVICON = '/favicon.png';
const ICON_SIZE = 64;
const FRAME_INTERVAL_MS = 150;

function getFaviconLink() {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

/**
 * Kým je isActive true, prekreslí favicon na pulzujúci zelený bodík (signalizuje,
 * že je na ťahu hráč v niektorej z jeho rozohraných hier). Inak vráti pôvodný favicon.
 */
export function useFaviconTurnIndicator(isActive) {
  const imageRef = useRef(null);

  useEffect(() => {
    if (!imageRef.current) {
      const img = new Image();
      img.src = ORIGINAL_FAVICON;
      imageRef.current = img;
    }
  }, []);

  useEffect(() => {
    const link = getFaviconLink();

    if (!isActive) {
      link.href = ORIGINAL_FAVICON;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d');

    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

      const img = imageRef.current;
      if (img && img.complete) {
        ctx.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);
      }

      frame = (frame + 1) % 30;
      const pulse = 0.5 + 0.5 * Math.sin((frame / 30) * Math.PI * 2);
      const radius = ICON_SIZE * 0.17 * (0.85 + 0.15 * pulse);
      const cx = ICON_SIZE - ICON_SIZE * 0.22;
      const cy = ICON_SIZE - ICON_SIZE * 0.22;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(40, 167, 69, ${0.75 + 0.25 * pulse})`;
      ctx.shadowColor = '#28a745';
      ctx.shadowBlur = 6;
      ctx.fill();

      link.href = canvas.toDataURL('image/png');
    };

    draw();
    const intervalId = setInterval(draw, FRAME_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      link.href = ORIGINAL_FAVICON;
    };
  }, [isActive]);
}
