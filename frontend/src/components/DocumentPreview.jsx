function DocumentPreview({
  title = '',
  renderedBody = '',
  protocolNumber,
  internalNumber,
  date,
  legalReferences = [],
  recipients = [],
  status = 'draft',
}) {
  const displayDate = date || new Date().toLocaleDateString('el-GR');

  return (
    <>
      <style>{`
        @media print {
          body > *:not(.a4-print-container) { display: none !important; }
          .a4-print-container { box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        className="a4-print-container mx-auto bg-white relative"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm 25mm',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          fontFamily: "'Literata', 'Georgia', serif",
          color: '#2d2d2d',
          lineHeight: 1.6,
        }}
      >
        {status === 'draft' && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ zIndex: 1 }}
          >
            <span
              style={{
                transform: 'rotate(-35deg)',
                fontSize: '80px',
                fontWeight: 700,
                color: 'rgba(200, 190, 180, 0.18)',
                letterSpacing: '12px',
                fontFamily: 'sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              ΠΡΟΣΧΕΔΙΟ
            </span>
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontSize: '8pt', fontFamily: "'Arial', sans-serif", lineHeight: 1.4, color: '#1e3a5f' }}>
              <div style={{ fontWeight: 700, fontSize: '9pt' }}>ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ</div>
              <div>ΠΕΡΙΦΕΡΕΙΑ ΑΤΤΙΚΗΣ</div>
              <div>ΓΕΝΙΚΗ Δ/ΝΣΗ ΔΗΜΟΣΙΑΣ ΥΓΕΙΑΣ</div>
              <div>& ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</div>
              <div>Δ/ΝΣΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</div>
              <div>ΤΜΗΜΑ ΚΟΙΝΩΝΙΚΗΣ ΑΛΛΗΛΕΓΓΥΗΣ</div>
            </div>
            <div style={{ fontSize: '9pt', fontFamily: "'Arial', sans-serif", textAlign: 'right', color: '#1e3a5f' }}>
              <div>Αθήνα, {displayDate}</div>
              {protocolNumber && <div>Αρ. Πρωτ.: {protocolNumber}</div>}
              {internalNumber && <div>Εσωτ. Αρ.: {internalNumber}</div>}
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e8e2d8', marginBottom: '16px' }} />

          <div style={{
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '11pt',
            fontFamily: "'Arial', sans-serif",
            margin: '8px 0 16px',
            color: '#1e3a5f',
          }}>
            ΘΕΜΑ: {title}
          </div>

          {legalReferences.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontWeight: 700,
                fontSize: '10pt',
                fontFamily: "'Arial', sans-serif",
                marginBottom: '6px',
              }}>
                Έχοντας υπόψη:
              </div>
              {legalReferences.map((ref, i) => (
                <div key={i} style={{
                  fontSize: '9pt',
                  fontFamily: "'Arial', sans-serif",
                  paddingLeft: '20px',
                  marginBottom: '3px',
                }}>
                  {i + 1}. {ref}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: '10pt',
              textAlign: 'justify',
              lineHeight: 1.7,
            }}
            dangerouslySetInnerHTML={{ __html: renderedBody }}
          />

          {recipients.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <div style={{
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '10pt',
                fontFamily: "'Arial', sans-serif",
                marginBottom: '8px',
              }}>
                ΠΙΝΑΚΑΣ ΑΠΟΔΕΚΤΩΝ
              </div>
              <table style={{
                width: '60%',
                margin: '0 auto',
                borderCollapse: 'collapse',
                fontSize: '9pt',
                fontFamily: "'Arial', sans-serif",
              }}>
                <tbody>
                  {recipients.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '2px 8px', width: '30px' }}>{i + 1}.</td>
                      <td style={{ padding: '2px 8px' }}>{r.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default DocumentPreview;
