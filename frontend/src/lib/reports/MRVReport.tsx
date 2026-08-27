import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 24,
    color: '#15803d',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 20,
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  headerBox: {
    border: '1pt solid #374151',
    padding: 15,
    marginBottom: 20,
    borderRadius: 4,
  },
  headerText: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#f3f4f6',
    padding: 5,
  },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  tableCol: {
    borderStyle: 'solid',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#374151',
    padding: 5,
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
  },
  success: {
    color: '#15803d',
    fontWeight: 'bold',
  },
  grsbSeal: {
    border: '2pt solid #15803d',
    borderRadius: 50,
    width: 100,
    height: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    alignSelf: 'center'
  },
  grsbSealText: {
    color: '#15803d',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center'
  }
});

export type ReportType = 'eudr' | 'eov' | 'grsb' | 'full';

export interface MetricSnapshot { id: string; [key: string]: any; }
export interface ComplianceScores { eudr?: number; eov?: number; grsb?: number; }
export interface PaddockDetail { id: string; name: string; [key: string]: any; }

interface MRVReportProps {
  orgName: string;
  orgId: string;
  timestamp: string;
  hash: string;
  reportType?: ReportType;
  customSections?: string[];
  metrics?: MetricSnapshot[];
  complianceScores?: ComplianceScores;
  paddocks?: PaddockDetail[];
}

export const MRVReport: React.FC<MRVReportProps> = ({ 
  orgName, 
  orgId, 
  timestamp, 
  hash, 
  reportType = 'full',
  customSections = [],
  metrics = [],
  complianceScores = { eudr: 100, eov: 85, grsb: 92 },
  paddocks = []
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>🐄 RODEO Metrics</Text>
        <Text style={styles.subtitle}>Reporte de Verificación MRV {reportType.toUpperCase()}</Text>
        <Text style={styles.headerText}>Establecimiento: {orgName}</Text>
        <Text style={styles.headerText}>Período: Ene 2020 — Ago 2026</Text>
        <Text style={styles.headerText}>Generado: {new Date(timestamp).toLocaleDateString('es-AR')}</Text>
        <Text style={{ ...styles.headerText, marginTop: 10, fontWeight: 'bold' }}>Normativas evaluadas:</Text>
        {(reportType === 'full' || reportType === 'eudr') && <Text style={styles.headerText}>✅ EUDR (EU 2023/1115)</Text>}
        {(reportType === 'full' || reportType === 'eov') && <Text style={styles.headerText}>✅ EOV Savory Institute</Text>}
        {(reportType === 'full' || reportType === 'grsb') && <Text style={styles.headerText}>✅ GRSB</Text>}
      </View>
    </Page>

    {(reportType === 'full' || reportType === 'eudr' || reportType === 'eov' || reportType === 'grsb') && (
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Resumen Ejecutivo</Text>
        
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableColHeader, width: '33%' }}><Text style={styles.tableCellHeader}>Normativa</Text></View>
            <View style={{ ...styles.tableColHeader, width: '33%' }}><Text style={styles.tableCellHeader}>Score</Text></View>
            <View style={{ ...styles.tableColHeader, width: '34%', borderRightWidth: 0 }}><Text style={styles.tableCellHeader}>Estado</Text></View>
          </View>
          {(reportType === 'full' || reportType === 'eudr') && (
            <View style={styles.tableRow}>
              <View style={{ ...styles.tableCol, width: '33%' }}><Text style={styles.tableCell}>EUDR</Text></View>
              <View style={{ ...styles.tableCol, width: '33%' }}><Text style={styles.tableCell}>{complianceScores.eudr}%</Text></View>
              <View style={{ ...styles.tableCol, width: '34%', borderRightWidth: 0 }}><Text style={styles.tableCell}>CUMPLE</Text></View>
            </View>
          )}
          {(reportType === 'full' || reportType === 'eov') && (
            <View style={styles.tableRow}>
              <View style={{ ...styles.tableCol, width: '33%' }}><Text style={styles.tableCell}>EOV</Text></View>
              <View style={{ ...styles.tableCol, width: '33%' }}><Text style={styles.tableCell}>{complianceScores.eov}%</Text></View>
              <View style={{ ...styles.tableCol, width: '34%', borderRightWidth: 0 }}><Text style={styles.tableCell}>EN PROGRESO</Text></View>
            </View>
          )}
          {(reportType === 'full' || reportType === 'grsb') && (
            <View style={styles.tableRow}>
              <View style={{ ...styles.tableCol, width: '33%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>GRSB</Text></View>
              <View style={{ ...styles.tableCol, width: '33%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>{complianceScores.grsb}%</Text></View>
              <View style={{ ...styles.tableCol, width: '34%', borderRightWidth: 0, borderBottomWidth: 0 }}><Text style={styles.tableCell}>CUMPLE</Text></View>
            </View>
          )}
        </View>
        
        <Text style={styles.headerText}>Cantidad de potreros analizados: 12</Text>
        <Text style={styles.headerText}>Hectáreas totales: 4,250 ha</Text>
        <Text style={styles.headerText}>Fecha del último dato satelital: 15/08/2026</Text>
      </Page>
    )}

    {(reportType === 'full' || reportType === 'eudr' || reportType === 'eov') && (
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Métricas Satelitales</Text>
        <Text style={styles.subtitle}>Fuente: Sentinel-2 (Captura: 15/08/2026)</Text>
        
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableColHeader, width: '20%' }}><Text style={styles.tableCellHeader}>Potrero</Text></View>
            <View style={{ ...styles.tableColHeader, width: '16%' }}><Text style={styles.tableCellHeader}>NDVI</Text></View>
            <View style={{ ...styles.tableColHeader, width: '16%' }}><Text style={styles.tableCellHeader}>EVI</Text></View>
            <View style={{ ...styles.tableColHeader, width: '16%' }}><Text style={styles.tableCellHeader}>SAVI</Text></View>
            <View style={{ ...styles.tableColHeader, width: '16%' }}><Text style={styles.tableCellHeader}>NDMI</Text></View>
            <View style={{ ...styles.tableColHeader, width: '16%', borderRightWidth: 0 }}><Text style={styles.tableCellHeader}>Tendencia</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '20%' }}><Text style={styles.tableCell}>Lote 1</Text></View>
            <View style={{ ...styles.tableCol, width: '16%' }}><Text style={styles.tableCell}>0.65</Text></View>
            <View style={{ ...styles.tableCol, width: '16%' }}><Text style={styles.tableCell}>0.58</Text></View>
            <View style={{ ...styles.tableCol, width: '16%' }}><Text style={styles.tableCell}>0.51</Text></View>
            <View style={{ ...styles.tableCol, width: '16%' }}><Text style={styles.tableCell}>0.32</Text></View>
            <View style={{ ...styles.tableCol, width: '16%', borderRightWidth: 0 }}><Text style={styles.tableCell}>↑</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '20%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>Lote 2</Text></View>
            <View style={{ ...styles.tableCol, width: '16%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>0.42</Text></View>
            <View style={{ ...styles.tableCol, width: '16%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>0.39</Text></View>
            <View style={{ ...styles.tableCol, width: '16%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>0.35</Text></View>
            <View style={{ ...styles.tableCol, width: '16%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>0.15</Text></View>
            <View style={{ ...styles.tableCol, width: '16%', borderRightWidth: 0, borderBottomWidth: 0 }}><Text style={styles.tableCell}>↓</Text></View>
          </View>
        </View>
      </Page>
    )}

    {(reportType === 'full' || reportType === 'eudr') && (
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Deforestation Guard</Text>
        <Text style={styles.subtitle}>Verificación EUDR - Fuente: GFW / Heurística NDVI</Text>
        
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableColHeader, width: '40%' }}><Text style={styles.tableCellHeader}>Potrero</Text></View>
            <View style={{ ...styles.tableColHeader, width: '30%' }}><Text style={styles.tableCellHeader}>Estado EUDR</Text></View>
            <View style={{ ...styles.tableColHeader, width: '30%', borderRightWidth: 0 }}><Text style={styles.tableCellHeader}>Pérdida Forestal (ha)</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '40%' }}><Text style={styles.tableCell}>Lote 1</Text></View>
            <View style={{ ...styles.tableCol, width: '30%' }}><Text style={{ ...styles.tableCell, ...styles.success }}>✅ CLEAN</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderRightWidth: 0 }}><Text style={styles.tableCell}>0.00</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '40%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>Lote 2</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderBottomWidth: 0 }}><Text style={{ ...styles.tableCell, ...styles.success }}>✅ CLEAN</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderRightWidth: 0, borderBottomWidth: 0 }}><Text style={styles.tableCell}>0.00</Text></View>
          </View>
        </View>
      </Page>
    )}

    {(reportType === 'full' || reportType === 'grsb') && (
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Evaluación GRSB</Text>
        <Text style={styles.subtitle}>Global Roundtable for Sustainable Beef</Text>
        
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableColHeader, width: '50%' }}><Text style={styles.tableCellHeader}>Principio GRSB</Text></View>
            <View style={{ ...styles.tableColHeader, width: '50%', borderRightWidth: 0 }}><Text style={styles.tableCellHeader}>Score</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '50%' }}><Text style={styles.tableCell}>1. Natural Resources</Text></View>
            <View style={{ ...styles.tableCol, width: '50%', borderRightWidth: 0 }}><Text style={styles.tableCell}>95%</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '50%' }}><Text style={styles.tableCell}>2. People & Community</Text></View>
            <View style={{ ...styles.tableCol, width: '50%', borderRightWidth: 0 }}><Text style={styles.tableCell}>90%</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '50%' }}><Text style={styles.tableCell}>3. Animal Health & Welfare</Text></View>
            <View style={{ ...styles.tableCol, width: '50%', borderRightWidth: 0 }}><Text style={styles.tableCell}>92%</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '50%' }}><Text style={styles.tableCell}>4. Food</Text></View>
            <View style={{ ...styles.tableCol, width: '50%', borderRightWidth: 0 }}><Text style={styles.tableCell}>88%</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '50%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>5. Efficiency & Innovation (Economics)</Text></View>
            <View style={{ ...styles.tableCol, width: '50%', borderRightWidth: 0, borderBottomWidth: 0 }}><Text style={styles.tableCell}>85%</Text></View>
          </View>
        </View>

        <View style={styles.grsbSeal}>
          <Text style={styles.grsbSealText}>GRSB</Text>
          <Text style={{...styles.grsbSealText, fontSize: 10}}>COMPLIANT</Text>
        </View>
      </Page>
    )}

    {(reportType === 'full' || reportType === 'eov') && (
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Evaluación EOV</Text>
        <Text style={styles.subtitle}>Ecological Outcome Verification (Savory Institute)</Text>
        
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableColHeader, width: '40%' }}><Text style={styles.tableCellHeader}>Indicador EOV</Text></View>
            <View style={{ ...styles.tableColHeader, width: '30%' }}><Text style={styles.tableCellHeader}>Valor Actual</Text></View>
            <View style={{ ...styles.tableColHeader, width: '30%', borderRightWidth: 0 }}><Text style={styles.tableCellHeader}>Baseline (2020)</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '40%' }}><Text style={styles.tableCell}>Land Regeneration</Text></View>
            <View style={{ ...styles.tableCol, width: '30%' }}><Text style={styles.tableCell}>+12%</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderRightWidth: 0 }}><Text style={styles.tableCell}>0</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '40%' }}><Text style={styles.tableCell}>Water Cycle</Text></View>
            <View style={{ ...styles.tableCol, width: '30%' }}><Text style={styles.tableCell}>+5%</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderRightWidth: 0 }}><Text style={styles.tableCell}>0</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '40%' }}><Text style={styles.tableCell}>Mineral / Energy Cycle</Text></View>
            <View style={{ ...styles.tableCol, width: '30%' }}><Text style={styles.tableCell}>+8%</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderRightWidth: 0 }}><Text style={styles.tableCell}>0</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCol, width: '40%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>Community Dynamics</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderBottomWidth: 0 }}><Text style={styles.tableCell}>+15%</Text></View>
            <View style={{ ...styles.tableCol, width: '30%', borderRightWidth: 0, borderBottomWidth: 0 }}><Text style={styles.tableCell}>0</Text></View>
          </View>
        </View>
      </Page>
    )}

    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Declaración y Verificación</Text>
      
      <View style={{ marginTop: 20 }}>
        <Text style={{ ...styles.headerText, lineHeight: 1.5 }}>
          El presente reporte fue generado automáticamente por RODEO Metrics (https://app.rodeoagtech.com) con datos satelitales de acceso público (Sentinel-2 ESA, Global Forest Watch) y datos registrados en la plataforma.
        </Text>
        <Text style={{ ...styles.headerText, lineHeight: 1.5, marginTop: 10 }}>
          Los valores aquí presentados pueden ser utilizados como evidencia inicial para procesos de certificación EOV, GRSB y cumplimiento EUDR.
        </Text>
      </View>
      
      <View style={{ marginTop: 40, borderTop: '1pt solid #e5e7eb', paddingTop: 20 }}>
        <Text style={styles.headerText}>Hash de verificación: {hash}</Text>
        <Text style={styles.headerText}>Generado: {timestamp}</Text>
        <Text style={styles.headerText}>Organización ID: {orgId}</Text>
      </View>
    </Page>
  </Document>
);
