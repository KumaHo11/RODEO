const fs = require('fs');
const path = require('path');

const baseDir = '/Users/javi/RODEO/frontend/src/app/(footer)';

const pages = [
  {
    path: 'mrv/satelital/page.tsx',
    title: 'MRV Satelital — 10 índices Sentinel-2 | Rodeo AgTech',
    badgeIcon: 'Antenna',
    badgeColor: 'text-blue-400',
    badgeBgColor: 'bg-blue-500/10 border border-blue-500/20',
    badgeText: 'MÓDULO MRV · SATELITAL',
    metrics: [
      { value: '10 índices', label: 'Sentinel-2 + SAR' },
      { value: 'Semanal', label: 'Actualización' },
      { value: '10m', label: 'Resolución espacial' },
      { value: 'Desde 2020', label: 'Time Machine' }
    ],
    heroTitle: 'Sabé cuánto pasto tenés<br />\n            <span className="text-blue-400">con una sola foto.</span>', // we should adjust
    // Wait, the prompt didn't specify hero titles. Let me look closer at the prompt.
  }
];
