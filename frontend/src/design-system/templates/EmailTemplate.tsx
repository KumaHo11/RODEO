/* eslint-disable @next/next/no-head-element */
import React from 'react';

export interface EmailTemplateProps {
  title: string;
  previewText?: string;
  body: React.ReactNode;
  ctaText?: string;
  ctaUrl?: string;
  footerText?: React.ReactNode;
}

/**
 * RODEO - Plantilla de Correo Transaccional
 * HTML email-safe template.
 */
export const EmailTemplate = ({
  title,
  previewText,
  body,
  ctaText,
  ctaUrl,
  footerText,
}: EmailTemplateProps) => {
  return (
    <html lang="es">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {/* Tipografía base: Helvetica, Arial, sans-serif */}
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            margin: 0;
            padding: 0;
            background-color: #F7F7F2;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #262628;
            -webkit-font-smoothing: antialiased;
          }
          table {
            border-spacing: 0;
            border-collapse: collapse;
          }
          td {
            padding: 0;
          }
          img {
            border: 0;
          }
          a {
            color: #008234;
            text-decoration: none;
          }
        `}} />
      </head>
      <body>
        {previewText && (
          <div style={{ display: 'none', maxWidth: 0, maxHeight: 0, overflow: 'hidden', color: '#F7F7F2' }}>
            {previewText}
          </div>
        )}
        
        <table width="100%" cellPadding="0" cellSpacing="0" border={0} style={{ backgroundColor: '#F7F7F2', padding: '40px 20px' }}>
          <tbody>
            <tr>
              <td align="center">
                {/* Canvas contenedor (max-width 600px): Fondo #FEFFF9, borde 1px solid #E5E5DB */}
                <table 
                  width="100%" 
                  cellPadding="0" 
                  cellSpacing="0" 
                  border={0} 
                  style={{ 
                    maxWidth: '600px', 
                    backgroundColor: '#FEFFF9',
                    border: '1px solid #E5E5DB',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}
                >
                  <tbody>
                    {/* Header */}
                    <tr>
                      <td style={{ padding: '32px 40px', backgroundColor: '#111D34', textAlign: 'center' }}>
                        <h1 style={{ color: '#FEFFF9', margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                          RODEO
                        </h1>
                      </td>
                    </tr>
                    
                    {/* Content */}
                    <tr>
                      <td style={{ padding: '40px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px', marginTop: 0 }}>
                          {title}
                        </h2>
                        
                        <div style={{ fontSize: '16px', lineHeight: '1.6', color: '#262628' }}>
                          {body}
                        </div>
                        
                        {/* CTA */}
                        {ctaText && ctaUrl && (
                          <div style={{ marginTop: '32px', textAlign: 'center' }}>
                            {/* Botón CTA: Fondo #008234, texto #FEFFF9, padding 14px 28px, border-radius 6px */}
                            <a 
                              href={ctaUrl} 
                              style={{ 
                                display: 'inline-block',
                                backgroundColor: '#008234', 
                                color: '#FEFFF9', 
                                padding: '14px 28px', 
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                textDecoration: 'none',
                                fontSize: '16px'
                              }}
                            >
                              {ctaText}
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                    
                    {/* Footer */}
                    <tr>
                      <td style={{ padding: '24px 40px', backgroundColor: '#F7F7F2', borderTop: '1px solid #E5E5DB', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '12px', color: '#787661' }}>
                          {footerText || '© 2026 RODEO. Todos los derechos reservados.'}
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
};
