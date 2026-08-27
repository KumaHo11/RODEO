const fs = require('fs');
const path = require('path');

const baseDir = '/Users/javi/RODEO/frontend/src/app/(footer)';

const iconImports = new Set(['ArrowRight', 'CheckCircle']);

const pages = [
  {
    path: 'mrv/satelital/page.tsx',
    title: 'MRV Satelital — 10 índices Sentinel-2 | Rodeo AgTech',
    badgeIcon: 'Antenna',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    badgeText: 'MÓDULO MRV · SATELITAL',
    heroTitle: '10 índices Sentinel-2.<br /><span className="text-blue-400">Time Machine desde 2020.</span>',
    heroDesc: 'Sin MRV digital, la única forma de verificar el estado de un campo es mandar un auditor físico cada año. Eso cuesta entre USD 15.000 y USD 50.000 por verificación. Rodeo automatiza ese proceso por potrero, por semana, sin visitas físicas.',
    metrics: [
      { value: '10 índices', label: 'Sentinel-2 + SAR' },
      { value: 'Semanal', label: 'Actualización' },
      { value: '10m', label: 'Resolución espacial' },
      { value: 'Desde 2020', label: 'Time Machine' },
    ],
    problemaTitle: 'Sin datos satelitales, tu campo no existe para el mercado de carbono.',
    problemaDesc: 'Sin MRV digital, la única forma de verificar el estado de un campo es mandar un auditor físico cada año. Eso cuesta entre USD 15.000 y USD 50.000 por verificación. Rodeo automatiza ese proceso por potrero, por semana, sin visitas físicas.',
    problemaBullets: [
      'Auditorías físicas anuales a USD 15k-50k por campo',
      'Sin datos históricos para baseline EUDR (2020)',
      'Imposibilidad de escalar la certificación a múltiples lotes'
    ],
    benefits: [
      { Icon: 'BarChart3', title: 'NDVI — Verdor y biomasa', desc: 'Índice de Vegetación de Diferencia Normalizada. Mide la densidad y salud del pasto por potrero.' },
      { Icon: 'Antenna', title: 'BSI — Suelo desnudo', desc: 'Bare Soil Index: detecta degradación, erosión y compactación. Alerta si supera el umbral EUDR.' },
      { Icon: 'Droplets', title: 'NDMI — Humedad foliar', desc: 'Normalized Difference Moisture Index: indica estrés hídrico de las pasturas.' },
      { Icon: 'TrendingUp', title: 'fCover — Cobertura verde', desc: 'Fracción de cobertura vegetal verde: clave para calcular el balance de carbono.' },
      { Icon: 'Layers', title: 'SAR Sentinel-1 — Humedad de suelo', desc: 'Radar de apertura sintética: penetra nubes. Humedad de suelo incluso en días cubiertos.' },
      { Icon: 'Clock', title: 'Time Machine 2020→hoy', desc: 'Backfill histórico mensual desde la línea de base EUDR (31/12/2020). Verificación retroactiva.' }
    ],
    useCases: [
      { title: 'Verificación EUDR', desc: 'El baseline de 2020 es obligatorio para exportar carne a Europa desde 2025. Rodeo construye ese baseline automáticamente.' },
      { title: 'Certificación de carbono', desc: 'Verra VM0026 requiere datos satelitales para calcular el SOC adicional. Los 10 índices de Rodeo son la fuente de datos.' },
      { title: 'Monitoreo de manejo regenerativo', desc: 'Seguí semana a semana si tus cambios de manejo están regenerando el suelo o solo manteniendo el statu quo.' }
    ],
    ctaLink: '/register',
    ctaText: 'Crear cuenta gratuita',
    ctaLink2: '/landing#mrv',
    ctaText2: 'Ver todos los módulos'
  },
  {
    path: 'mrv/deforestation-guard/page.tsx',
    title: 'Deforestation Guard EUDR 2023/1115 | Rodeo AgTech',
    badgeIcon: 'ShieldCheck',
    badgeClass: 'text-red-400 bg-red-500/10 border-red-500/20',
    badgeText: 'MÓDULO MRV · DEFORESTATION GUARD',
    heroTitle: 'Deforestation Guard<br /><span className="text-red-400">EUDR 2023/1115</span>',
    heroDesc: 'Un campo que deforestó post-2020 no puede vender créditos de carbono ni exportar carne a Europa.',
    metrics: [
      { value: '31/12/2020', label: 'Fecha de corte EUDR' },
      { value: 'GFW', label: 'Global Forest Watch' },
      { value: 'Tiempo real', label: 'Alertas automáticas' },
      { value: 'EUDR 2023/1115', label: 'Norma aplicada' }
    ],
    problemaTitle: 'Un campo que deforestó post-2020 no puede vender créditos de carbono ni exportar carne a Europa.',
    problemaDesc: 'La reglamentación de la Unión Europea y los estándares de carbono requieren evidencia innegable de la ausencia de deforestación desde el 31/12/2020. No cumplirlo te deja fuera de los mercados más rentables.',
    problemaBullets: [
      'Pérdida de elegibilidad para mercados premium y de exportación',
      'Riesgos de multas y bloqueos por incumplimiento normativo',
      'Desvalorización de los productos ganaderos en la cadena de suministro'
    ],
    benefits: [
      { Icon: 'ShieldCheck', title: 'Verificación Global Forest Watch', desc: 'Cruzamos el polígono de cada potrero con la capa Hansen de pérdida de bosque. Resolución 30m.' },
      { Icon: 'AlertTriangle', title: 'Alertas en tiempo real', desc: 'Si GLAD Alerts detecta una perturbación en tu campo, recibís una notificación en 48hs.' },
      { Icon: 'Map', title: 'Overlay visual en el mapa', desc: 'Los potreros se colorean: verde (OK), naranja (verificar), rojo (incumplimiento EUDR). Directo en el mapa.' },
      { Icon: 'FileText', title: 'Declaración de debida diligencia', desc: 'Generamos automáticamente el borrador de la declaración EUDR con los datos verificados del campo.' },
      { Icon: 'Clock', title: 'Baseline histórico 2020', desc: 'Reconstruimos el estado del campo al 31/12/2020 usando datos de archivo. Cumplís el baseline sin datos propios previos.' },
      { Icon: 'TrendingUp', title: 'Score de riesgo por potrero', desc: 'Cada potrero recibe un score de 0-100 de riesgo de deforestación. Priorizá verificaciones en campo.' }
    ],
    useCases: [
      { title: 'Exportación de carne a Europa', desc: 'El EUDR exige due diligence de deforestación para carne, cuero y soja. Rodeo genera el reporte automático.' },
      { title: 'Elegibilidad para créditos de carbono', desc: 'Todos los estándares de carbono (Verra, Gold Standard) exigen ausencia de deforestación post-2020. Rodeo lo certifica.' },
      { title: 'Insetting corporativo Scope 3', desc: 'Empresas que compran créditos de insetting exigen verificación EUDR del campo productor. Rodeo es el proveedor de esa verificación.' }
    ],
    ctaLink: '/register',
    ctaText: 'Crear cuenta gratuita',
    ctaLink2: '/landing#mrv',
    ctaText2: 'Ver todos los módulos'
  },
  {
    path: 'mrv/compliance/page.tsx',
    title: 'Compliance Dashboard EUDR / EOV / GRSB | Rodeo AgTech',
    badgeIcon: 'ClipboardCheck',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    badgeText: 'MÓDULO MRV · COMPLIANCE',
    heroTitle: 'Compliance Dashboard<br /><span className="text-amber-400">EUDR / EOV / GRSB</span>',
    heroDesc: 'Cumplir con EUDR, EOV y GRSB simultáneamente requería hasta ahora contratar 3 auditores distintos.',
    metrics: [
      { value: '3 normas', label: 'EUDR · EOV · GRSB' },
      { value: 'Por potrero', label: 'Granularidad' },
      { value: 'PDF SHA256', label: 'Reportes auditables' },
      { value: 'Semáforo', label: 'Dashboard visual' }
    ],
    problemaTitle: 'Cumplir con EUDR, EOV y GRSB simultáneamente requería hasta ahora contratar 3 auditores distintos.',
    problemaDesc: 'Las regulaciones y estándares privados se multiplican. Manejar la documentación y las auditorías por separado es insostenible operativamente y un gasto innecesario. Rodeo centraliza todo en un único dashboard.',
    problemaBullets: [
      'Multiplicidad de estándares (EUDR, EOV, GRSB) requiriendo distintas evidencias',
      'Altos costos en múltiples certificaciones y consultorías',
      'Dificultad para mantener documentación auditable e inmutable a lo largo del tiempo'
    ],
    benefits: [
      { Icon: 'ClipboardCheck', title: 'Score EUDR por potrero', desc: 'Verde/naranja/rojo según cumplimiento de deforestación, cadena de custodia y due diligence.' },
      { Icon: 'Leaf', title: 'EOV Savory Institute', desc: 'Ecological Outcome Verification: 4 indicadores (cobertura, diversidad, función hídrica, ciclo de carbono) medidos con Sentinel-2.' },
      { Icon: 'Shield', title: 'GRSB Standard', desc: 'Global Roundtable for Sustainable Beef: 5 principios verificables con datos satelitales y de gestión del campo.' },
      { Icon: 'FileText', title: 'Reporte PDF con hash SHA256', desc: 'Cada reporte tiene un hash criptográfico SHA256 verificable públicamente. Inmutable y auditable.' },
      { Icon: 'Bell', title: 'Alertas de incumplimiento', desc: 'Notificación automática cuando un potrero cambia de estado verde a naranja o rojo en cualquier norma.' },
      { Icon: 'BarChart3', title: 'Dashboard de tendencias', desc: 'Evolución de scores en el tiempo. Comprobá si el manejo está mejorando el cumplimiento normativo.' }
    ],
    useCases: [
      { title: 'Auditorías de compradores internacionales', desc: 'Frigoríficos y traders europeos exigen due diligence. Rodeo genera el paquete de evidencias en un click.' },
      { title: 'Certificación Savory EOV', desc: 'El proceso de certificación EOV requiere 3 años de datos. Rodeo construye ese historial desde el día uno.' },
      { title: 'Acceso a financiamiento verde', desc: 'Bancos y fondos de impacto exigen compliance normativo como condición de crédito. El dashboard es la evidencia.' }
    ],
    ctaLink: '/register',
    ctaText: 'Crear cuenta gratuita',
    ctaLink2: '/landing#mrv',
    ctaText2: 'Ver todos los módulos'
  },
  {
    path: 'mrv/registro-rfid/page.tsx',
    title: 'Registro RFID + Trazabilidad Individual | Rodeo AgTech',
    badgeIcon: 'ScanLine',
    badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    badgeText: 'MÓDULO MRV · RFID',
    heroTitle: 'Registro RFID +<br /><span className="text-amber-400">Trazabilidad Individual</span>',
    heroDesc: 'Sin trazabilidad individual, no podés calcular la huella de carbono por animal ni cumplir con insetting Scope 3.',
    metrics: [
      { value: 'Gallagher HR5', label: 'Lector recomendado' },
      { value: 'Allflex EID', label: 'Caravana ISO 11784' },
      { value: '100% Offline', label: 'Modo de campo' },
      { value: 'CSV + BLE', label: 'Importación' }
    ],
    problemaTitle: 'Sin trazabilidad individual, no podés calcular la huella de carbono por animal ni cumplir con insetting Scope 3.',
    problemaDesc: 'El mercado actual demanda conocer el historial de cada animal de forma granular. Sin un sistema de trazabilidad individual ágil y que funcione offline, estás perdiendo el valor agregado de tu producción.',
    problemaBullets: [
      'Imposibilidad de cumplir requisitos de Scope 3',
      'Pérdida de datos en el campo debido a la falta de conectividad y herramientas manuales',
      'Desaprovechamiento del valor de la información por animal para frigoríficos y exportadores'
    ],
    benefits: [
      { Icon: 'ScanLine', title: 'Web Bluetooth RFID', desc: 'Lectura directa desde el lector Gallagher HR5 o Tru-Test SRS2 vía Bluetooth. Sin apps adicionales.' },
      { Icon: 'FileText', title: 'Importación CSV Allflex', desc: 'Importá el archivo de exportación de tu lector Allflex directamente. Detección automática del formato.' },
      { Icon: 'Footprints', title: 'Bitácora de vida completa', desc: 'Pesajes, vacunas, pariciones, movimientos entre potreros. Todo el historial del animal en un solo lugar.' },
      { Icon: 'WifiOff', title: 'Modo offline + cola de sync', desc: 'Escaneá en campo sin señal. Los datos se encolan y sincronizan automáticamente al recuperar conectividad.' },
      { Icon: 'TrendingUp', title: 'Trazabilidad de potreros', desc: 'Cada animal tiene registro de qué potrero ocupó, cuántos días y qué pasturas consumió.' },
      { Icon: 'Globe', title: 'Exportación a frigoríficos', desc: 'API B2B para compartir trazabilidad con compradores, frigoríficos y exportadores. Control total de permisos.' }
    ],
    useCases: [
      { title: 'Cálculo de huella de carbono por lote', desc: 'Con trazabilidad individual, la huella de carbono se calcula por categoría animal real. Más preciso que estimaciones de rodeo.' },
      { title: 'Insetting Scope 3 corporativo', desc: 'Las empresas que compran carne para sus cadenas de valor necesitan la huella de carbono por animal. Rodeo es el puente.' },
      { title: 'Certificación sanitaria y exportación', desc: 'SENASA y sistemas de exportación requieren trazabilidad individual. El registro de Rodeo cumple con el Resolución SENASA 754.' }
    ],
    ctaLink: '/register',
    ctaText: 'Crear cuenta gratuita',
    ctaLink2: '/landing#mrv',
    ctaText2: 'Ver todos los módulos'
  },
  {
    path: 'mrv/huella-carbono/page.tsx',
    title: 'Huella de Carbono Ganadera IPCC Tier 1 | Rodeo AgTech',
    badgeIcon: 'Leaf',
    badgeClass: 'text-green-400 bg-green-500/10 border-green-500/20',
    badgeText: 'MÓDULO MRV · HUELLA DE CARBONO',
    heroTitle: 'Huella de Carbono<br /><span className="text-green-400">Ganadera IPCC Tier 1</span>',
    heroDesc: 'Sin calcular tu balance de carbono, no sabés si tu campo es sumidero o emisor, ni cuánto vale ese dato en el mercado.',
    metrics: [
      { value: 'IPCC 2006', label: 'Metodología' },
      { value: 'GWP100 AR6', label: 'CH₄=27.9 · N₂O=273' },
      { value: 'tCO₂e', label: 'Por potrero y estancia' },
      { value: 'Tier 1', label: 'Punto de partida' }
    ],
    problemaTitle: 'Sin calcular tu balance de carbono, no sabés si tu campo es sumidero o emisor, ni cuánto vale ese dato en el mercado.',
    problemaDesc: 'La huella de carbono es la nueva métrica financiera de la ganadería. Si no la medís, estás dejando dinero en la mesa y cerrando la puerta a mercados internacionales que pronto la exigirán como estándar.',
    problemaBullets: [
      'Desconocimiento del impacto real y potencial de secuestro',
      'Incapacidad de monetizar prácticas regenerativas en el mercado voluntario',
      'Barreras comerciales ante corporaciones con compromisos Net Zero'
    ],
    benefits: [
      { Icon: 'Leaf', title: 'Emisiones CH₄ entérico', desc: 'Factor IPCC 64 kg CH₄/cabeza/año (subtropical/pampa). Convertido con GWP100 AR6 (27.9).' },
      { Icon: 'Wind', title: 'N₂O de estiércol', desc: 'EF3PRP IPCC: 1% del N excretado. Emisiones de pastoreo directo calculadas por potrero.' },
      { Icon: 'Sprout', title: 'Secuestro SOC satelital', desc: 'Proxy de carbono orgánico del suelo estimado con Sentinel-2. 0.2 tC/ha/año base, ajustado por estado del suelo.' },
      { Icon: 'BarChart3', title: 'Balance neto por potrero', desc: 'Emisiones brutas menos secuestro = balance neto en tCO₂e. Identificá qué potreros son sumideros y cuáles son emisores.' },
      { Icon: 'TrendingUp', title: 'Tendencia anual', desc: 'Seguí la evolución del balance año a año. Documentá la mejora del manejo regenerativo con datos verificables.' },
      { Icon: 'FileText', title: 'Paso previo a Verra VM0026', desc: 'El IPCC Tier 1 es el punto de entrada. Con muestras de suelo, escalás a Tier 2 y habilitás certificación Verra.' }
    ],
    useCases: [
      { title: 'Mercado voluntario de carbono', desc: 'NBS a 15-24 USD/t con MRV moderno. Un campo de 500 ha en balance neutro puede generar USD 7.500-12.000/año en créditos.' },
      { title: 'Insetting Scope 3', desc: 'Empresas con metas SBTi V2.0 compran créditos de insetting de sus proveedores de carne. Rodeo es el MRV que habilita esa transacción.' },
      { title: 'CORSIA elegibilidad', desc: 'Con carta soberana argentina y balance verificado, tu campo puede acceder al mercado de aviación CORSIA a 33-53 USD/t.' }
    ],
    ctaLink: '/register',
    ctaText: 'Crear cuenta gratuita',
    ctaLink2: '/landing#mrv',
    ctaText2: 'Ver todos los módulos'
  },
  // Normativas (Short Pages)
  {
    path: 'normativas/eudr/page.tsx',
    title: 'EUDR 2023/1115 — Regulación Europea de Deforestación | Rodeo AgTech',
    badgeIcon: 'ShieldCheck',
    badgeClass: 'text-red-400 bg-red-500/10 border-red-500/20',
    badgeText: 'NORMATIVA',
    heroTitle: 'El EUDR no es opcional.<br /><span className="text-red-400">Es la nueva barrera de entrada al mercado europeo.</span>',
    heroDesc: 'Desde enero 2025, toda exportación de carne, soja, cuero y madera a Europa debe acreditar ausencia de deforestación post-31/12/2020. Sin esa acreditación, el embarque no entra.',
    metrics: [], // We can skip metrics or leave empty
    problemaTitle: 'La nueva barrera del mercado europeo.',
    problemaDesc: 'Desde enero 2025, toda exportación de carne, soja, cuero y madera a Europa debe acreditar ausencia de deforestación post-31/12/2020. Sin esa acreditación, el embarque no entra.',
    problemaBullets: [],
    benefits: [
      { Icon: 'ShieldCheck', title: 'Obligatorio desde enero 2025', desc: 'Para carne, cuero, soja, madera, cacao, café, aceite de palma y sus derivados.' },
      { Icon: 'Map', title: 'Due diligence por parcela', desc: 'La norma exige geolocalización exacta de cada parcela de producción. Los polígonos de Rodeo cumplen ese requisito.' },
      { Icon: 'FileText', title: 'Declaración digital', desc: 'El reglamento exige una declaración digital de due diligence por cada lote exportado. Rodeo la genera automáticamente.' },
      { Icon: 'AlertTriangle', title: 'Multa de hasta EUR 4% de facturación', desc: 'El incumplimiento implica sanciones proporcionales a la facturación de la empresa importadora.' }
    ],
    useCases: [],
    ctaLink: 'mailto:ventas@rodeoagtech.com?subject=EUDR+Compliance',
    ctaText: 'Hablar con ventas',
    ctaLink2: '/landing#mrv',
    ctaText2: 'Ver solución técnica'
  },
  {
    path: 'normativas/eov/page.tsx',
    title: 'EOV Savory Institute — Ecological Outcome Verification | Rodeo AgTech',
    badgeIcon: 'Leaf',
    badgeClass: 'text-green-400 bg-green-500/10 border-green-500/20',
    badgeText: 'NORMATIVA',
    heroTitle: 'La única certificación que mide<br /><span className="text-green-400">si tu manejo holístico realmente regenera.</span>',
    heroDesc: 'El mercado de carbono y los compradores de carne premium exigen evidencia de que el manejo regenerativo mejora el ecosistema. EOV es el estándar.',
    metrics: [],
    problemaTitle: 'Manejo holístico: de la intuición a la verificación.',
    problemaDesc: 'El mercado de carbono y los compradores de carne premium exigen evidencia de que el manejo regenerativo mejora el ecosistema. EOV es el estándar.',
    problemaBullets: [],
    benefits: [
      { Icon: 'Leaf', title: '4 indicadores ecológicos', desc: 'Cobertura vegetal, diversidad de especies, función hídrica y ciclo de carbono medidos con Sentinel-2.' },
      { Icon: 'TrendingUp', title: 'Verificación anual', desc: 'El proceso EOV requiere mediciones anuales durante 3 años. Rodeo automatiza las mediciones satelitales.' },
      { Icon: 'FileText', title: 'Certificado Savory', desc: 'Con datos verificados, accedés al proceso de certificación formal del Savory Institute.' },
      { Icon: 'Globe', title: 'Mercado de carne premium', desc: 'Frigoríficos y retailers que pagan premium por carne holística exigen certificación EOV como evidencia.' }
    ],
    useCases: [],
    ctaLink: '/landing#mrv',
    ctaText: 'Ir a MRV Digital',
    ctaLink2: '',
    ctaText2: ''
  },
  {
    path: 'normativas/grsb/page.tsx',
    title: 'GRSB Standard — Global Roundtable for Sustainable Beef | Rodeo AgTech',
    badgeIcon: 'Shield',
    badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    badgeText: 'NORMATIVA',
    heroTitle: 'El estándar global de sustentabilidad bovina<br /><span className="text-blue-400">que el mundo exige.</span>',
    heroDesc: 'Los principales frigoríficos exportadores y sus clientes globales (McDonald\'s, Walmart, JBS) exigen GRSB para sus proveedores de carne bovina.',
    metrics: [],
    problemaTitle: 'Sustentabilidad bovina a nivel global.',
    problemaDesc: 'Los principales frigoríficos exportadores y sus clientes globales (McDonald\'s, Walmart, JBS) exigen GRSB para sus proveedores de carne bovina.',
    problemaBullets: [],
    benefits: [
      { Icon: 'Shield', title: '5 principios GRSB', desc: 'Natural Resources, People & Community, Animal Health & Welfare, Food Safety, Economic Viability. Rodeo mide los primeros dos con datos satelitales.' },
      { Icon: 'BarChart3', title: 'Indicadores verificables', desc: 'Cobertura vegetal (Sentinel-2), uso de agua (NDMI), diversidad de pasturas (fCover heterogeneidad).' },
      { Icon: 'Building2', title: 'Acceso a cadenas globales', desc: 'JBS, Marfrig, Tyson Foods y Cargill exigen GRSB a sus proveedores. El dashboard de Rodeo es la evidencia.' },
      { Icon: 'FileText', title: 'Reporte anual GRSB', desc: 'Rodeo genera el reporte de indicadores GRSB automáticamente con datos satelitales y de gestión.' }
    ],
    useCases: [],
    ctaLink: '/landing#mrv',
    ctaText: 'Ir a MRV Digital',
    ctaLink2: '',
    ctaText2: ''
  },
  // Mercado (Short Pages but with big numbers? The prompt says "4 grande cards con números" for mrv-digital and standard ones for nbs-voluntario)
  // We'll adapt it inside the benefits format.
  {
    path: 'mercado/mrv-digital/page.tsx',
    title: 'Qué es el MRV Digital y Por Qué Vale Más | Rodeo AgTech',
    badgeIcon: 'BarChart3',
    badgeClass: 'text-green-400 bg-green-500/10 border-green-500/20',
    badgeText: 'MERCADO',
    heroTitle: 'MRV: Monitoreo, Reporte y Verificación.<br /><span className="text-green-400">El dato que vale dinero.</span>',
    heroDesc: 'Un crédito de carbono sin MRV vale USD 7/t. El mismo crédito con MRV satelital vale USD 15-24/t. La diferencia es el dato verificable.',
    metrics: [],
    problemaTitle: 'La diferencia es el dato verificable.',
    problemaDesc: 'Un crédito de carbono sin MRV vale USD 7/t. El mismo crédito con MRV satelital vale USD 15-24/t. La diferencia es el dato verificable.',
    problemaBullets: [],
    benefits: [
      { Icon: 'TrendingUp', title: '+217% Prima de precio', desc: 'Datos documentados del mercado GMF agosto 2026: créditos con MRV moderno valen 3.17x más.' },
      { Icon: 'Clock', title: '50-70% Reducción de costos', desc: 'El MRV digital reemplaza auditorías físicas de USD 15k-50k por procesos satelitales automáticos.' },
      { Icon: 'Shield', title: 'USD 0 Exposición al precio de carbono', desc: 'Rodeo cobra por tonelada monitoreada, no por tonelada vendida.' },
      { Icon: 'Globe', title: '122-198 Mt Demanda CORSIA', desc: 'Solo 38 Mt elegibles. La oferta con MRV verificado tiene el mercado para sí.' }
    ],
    useCases: [],
    ctaLink: '/landing#mercado',
    ctaText: 'Ir a Mercado',
    ctaLink2: '',
    ctaText2: ''
  },
  {
    path: 'mercado/nbs-voluntario/page.tsx',
    title: 'NBS Voluntario — Créditos de Carbono para Ganadería Regenerativa | Rodeo AgTech',
    badgeIcon: 'Leaf',
    badgeClass: 'text-green-400 bg-green-500/10 border-green-500/20',
    badgeText: 'MERCADO',
    heroTitle: 'Nature Based Solutions:<br /><span className="text-green-400">el mercado que premia al ganadero que regenera.</span>',
    heroDesc: 'El mercado voluntario de carbono NBS vale USD 2.000M en 2026, pero solo el 8% de los proyectos tiene MRV digital. Los que lo tienen capturan el 80% del precio.',
    metrics: [],
    problemaTitle: 'Capturando el precio premium.',
    problemaDesc: 'El mercado voluntario de carbono NBS vale USD 2.000M en 2026, pero solo el 8% de los proyectos tiene MRV digital. Los que lo tienen capturan el 80% del precio.',
    problemaBullets: [],
    benefits: [
      { Icon: 'TrendingUp', title: 'Escalera de precios NBS', desc: 'USD 7/t (genérico) → USD 15/t (con MRV) → USD 24/t (premium documentado).' },
      { Icon: 'Leaf', title: 'Metodología Verra VM0026', desc: 'Improved Grassland Management: la metodología de certificación más usada para ganadería regenerativa en LATAM.' },
      { Icon: 'Globe', title: 'Acceso al mercado voluntario', desc: 'Compradores directos: Microsoft, Delta Airlines, corporativos con metas SBTi. Rodeo es el puente de datos.' },
      { Icon: 'FileText', title: 'Primer paso: IPCC Tier 1', desc: 'Con la Huella de Carbono de Rodeo tenés el baseline. El siguiente paso es muestras de suelo para Tier 2.' }
    ],
    useCases: [],
    ctaLink: 'mailto:ventas@rodeoagtech.com?subject=NBS+Voluntario',
    ctaText: 'Contactar ventas',
    ctaLink2: '/landing#mrv',
    ctaText2: 'Ver tecnología'
  }
];

pages.forEach(page => {
  page.benefits.forEach(b => iconImports.add(b.Icon));
  iconImports.add(page.badgeIcon);
});

pages.forEach(page => {
  const fileDir = path.join(baseDir, path.dirname(page.path));
  fs.mkdirSync(fileDir, { recursive: true });

  const importsArray = Array.from(iconImports).join(', ');

  const metricsSection = page.metrics && page.metrics.length > 0 ? `
      {/* METRIC STRIP */}
      <section className="bg-green-600 py-10">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
${page.metrics.map(m => `              { value: '${m.value}', label: '${m.label}' }`).join(',\n')}
            ].map((m, i) => (
              <div key={i}>
                <div className="text-2xl font-black text-white">{m.value}</div>
                <div className="text-green-200 text-xs font-medium mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
` : '';

  const bulletsSection = page.problemaBullets && page.problemaBullets.length > 0 ? `
              <div className="space-y-3">
                {[
${page.problemaBullets.map(b => `                  '${b}'`).join(',\n')}
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>` : '';

  const useCasesSection = page.useCases && page.useCases.length > 0 ? `
      {/* USE CASES */}
      <section className="py-20 bg-gray-950">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              CASOS DE USO
            </div>
            <h2 className="text-3xl font-black text-white mb-3">
              Para cada sistema productivo.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
${page.useCases.map(uc => `              { title: '${uc.title}', desc: '${uc.desc}' }`).join(',\n')}
            ].map(({ title, desc }, i) => (
              <div key={i} className="bg-white/5 border border-white/8 rounded-2xl p-6">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-white text-xs font-black">0{i + 1}</span>
                </div>
                <h3 className="text-white font-bold mb-2 text-sm">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
` : '';

  const ctaLink2Section = page.ctaLink2 ? `
            <Link href="${page.ctaLink2}"
              className="inline-flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 border border-white/15 text-white font-medium px-7 py-3.5 rounded-xl text-sm transition-all">
              ${page.ctaText2}
            </Link>` : '';

  const finalCtaLink2 = page.ctaLink2 ? `
          <Link href="${page.ctaLink2}"
            className="mt-4 inline-block text-gray-500 hover:text-green-600 font-medium ml-4 transition-all text-base">
            ${page.ctaText2}
          </Link>` : '';

  const content = `import type { Metadata } from 'next'
import Link from 'next/link'
import { ${importsArray} } from 'lucide-react'

export const metadata: Metadata = {
  title: '${page.title}',
  description: '${page.heroDesc}',
}

export default function Page() {
  return (
    <>
      <title>{'${page.title}'}</title>

      {/* HERO */}
      <section className="bg-gradient-to-br from-gray-950 via-green-950 to-gray-950 py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 ${page.badgeClass} text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8">
            <${page.badgeIcon} className="w-3.5 h-3.5" />
            ${page.badgeText}
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6" dangerouslySetInnerHTML={{ __html: '${page.heroTitle}' }} />
          <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            ${page.heroDesc}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="${page.ctaLink}"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-green-600/30">
              ${page.ctaText}
              <ArrowRight className="w-4 h-4" />
            </Link>${ctaLink2Section}
          </div>
        </div>
      </section>
${metricsSection}
      {/* EL PROBLEMA */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
                EL PROBLEMA
              </div>
              <h2 className="text-3xl font-black text-gray-950 mb-4">
                ${page.problemaTitle}
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                ${page.problemaDesc}
              </p>
${bulletsSection}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <${page.badgeIcon} className="w-8 h-8 text-green-600" />
              </div>
              <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">VERIFICADO</div>
              <div className="text-4xl font-black text-gray-950 mb-1">RODEO</div>
              <div className="text-sm text-gray-500 mb-4">Infraestructura Digital</div>
              <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                Auditable e Inmutable
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS GRID */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-500 text-xs font-bold tracking-widest px-3 py-1.5 rounded-full mb-6">
              BENEFICIOS
            </div>
            <h2 className="text-3xl font-black text-gray-950 mb-3">
              Herramientas de Precisión.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
${page.benefits.map(b => `              { Icon: ${b.Icon}, title: '${b.title}', desc: '${b.desc}' }`).join(',\n')}
            ].map(({ Icon, title, desc }, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-green-100 hover:bg-green-50/30 transition-all">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-sm">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
${useCasesSection}
      {/* CTA FINAL */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black text-gray-950 mb-4">
            Empezá a medir.
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Sumate a la plataforma AgTech de referencia.
          </p>
          <Link href="${page.ctaLink}"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4 rounded-xl text-base transition-all shadow-lg shadow-green-600/30">
            ${page.ctaText}
            <ArrowRight className="w-4 h-4" />
          </Link>${finalCtaLink2}
        </div>
      </section>
    </>
  )
}
`;

  fs.writeFileSync(path.join(baseDir, page.path), content);
});
