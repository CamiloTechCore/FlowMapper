import { CATALOG } from '../workflow/model';
export const NODE_CONFIG = {
  ...Object.fromEntries(Object.entries(CATALOG).map(([key, c]) => [key, { color: parseInt(c.color.slice(1), 16), hex: c.color, label: c.label.toUpperCase(), emoji: c.icon }])),
  inicio: { color: 0x4ade80, hex: '#4ade80', label: 'INICIO', emoji: '🟢' },
  paso: { color: 0x60a5fa, hex: '#60a5fa', label: 'PASO', emoji: '🔵' },
  decision: { color: 0xfacc15, hex: '#facc15', label: 'DECISIÓN', emoji: '🟡' },
  fin: { color: 0xc084fc, hex: '#c084fc', label: 'FIN', emoji: '🟣' },
  'flujo-externo': { color: 0x67e8f9, hex: '#67e8f9', label: 'EXTERNO', emoji: '🔗' },
};
