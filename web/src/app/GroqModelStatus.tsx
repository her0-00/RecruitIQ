'use client';

import { useState, useEffect } from 'react';
import { Server, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface ModelStatus {
  model: string;
  status: 'active' | 'rate-limited' | 'decommissioned' | 'error';
  tokensRemaining?: string;
  tokensLimit?: string;
  requestsRemaining?: string;
  requestsLimit?: string;
  resetTime?: string;
  latency?: string;
  error?: string;
}

export default function GroqModelStatus({ apiKey }: { apiKey: string }) {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetchStatus = async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const res = await fetch('/api/groq-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey })
      });
      const data = await res.json();
      if (data.models) {
        setModels(data.models);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch model status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!apiKey) return;
    fetchStatus();
    // Removed auto-refresh - only manual refresh or on API key change
  }, [apiKey]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 size={14} color="#10B981" />;
      case 'rate-limited':
        return <AlertTriangle size={14} color="#F59E0B" />;
      case 'decommissioned':
      case 'error':
        return <XCircle size={14} color="#EF4444" />;
      default:
        return <Server size={14} color="#6B7280" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'rate-limited':
        return '#F59E0B';
      case 'decommissioned':
      case 'error':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const canUseModel = (tokensRem: string | undefined, tokensLim: string | undefined, reqRem: string | undefined, reqLim: string | undefined) => {
    if (!tokensRem || !tokensLim || !reqRem || !reqLim) return false;
    if (tokensRem === 'N/A' || tokensLim === 'N/A' || reqRem === 'N/A' || reqLim === 'N/A') return false;
    
    const tRem = parseFloat(tokensRem);
    const tLim = parseFloat(tokensLim);
    const rRem = parseFloat(reqRem);
    const rLim = parseFloat(reqLim);
    
    if (isNaN(tRem) || isNaN(tLim) || isNaN(rRem) || isNaN(rLim)) return false;
    
    // Need at least 1000 tokens and 1 request to run an analysis
    return tRem >= 1000 && rRem >= 1;
  };

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      {!apiKey ? (
        <div style={{
          textAlign: 'center',
          padding: '1rem',
          color: 'var(--text3)',
          fontSize: '0.7rem'
        }}>
          Entrez votre clé API Groq pour voir l'état des modèles
        </div>
      ) : (
        <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: collapsed ? '0' : '1rem',
        cursor: 'pointer'
      }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={16} color="var(--gold)" />
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            color: 'var(--gold)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            Groq Models Status
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!collapsed && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchStatus(); }}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--text3)',
                fontSize: '0.65rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.borderColor = 'var(--gold)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <RefreshCw 
                size={12} 
                style={{ 
                  animation: loading ? 'spin 1s linear infinite' : 'none',
                  transformOrigin: 'center'
                }} 
              />
              Refresh
            </button>
          )}
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </div>

      {!collapsed && (
        <>
      {lastUpdate && (
        <div style={{
          fontSize: '0.6rem',
          color: 'var(--text3)',
          marginBottom: '0.8rem',
          fontFamily: 'Space Mono, monospace'
        }}>
          Last update: {lastUpdate.toLocaleTimeString()}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {models.map((model) => (
          <div
            key={model.model}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${getStatusColor(model.status)}`,
              borderRadius: '6px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              {getStatusIcon(model.status)}
              <span style={{
                fontSize: '0.7rem',
                fontFamily: 'Space Mono, monospace',
                color: 'var(--text1)',
                fontWeight: 600
              }}>
                {model.model}
              </span>
            </div>

            {model.status === 'active' && (
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                {canUseModel(model.tokensRemaining, model.tokensLimit, model.requestsRemaining, model.requestsLimit) ? (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#10B981',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    ✓ READY
                  </span>
                ) : (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: '#F59E0B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    ⚠ RATE LIMITED
                  </span>
                )}
                <span style={{ fontSize: '0.6rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace' }}>
                  {model.latency}
                </span>
              </div>
            )}

            {model.status === 'rate-limited' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <span style={{
                  fontSize: '0.6rem',
                  color: '#F59E0B',
                  fontWeight: 700,
                  textTransform: 'uppercase'
                }}>
                  Quota Exhausted
                </span>
                {model.resetTime && model.resetTime !== 'N/A' && (
                  <span style={{ fontSize: '0.55rem', color: 'var(--text3)', fontFamily: 'Space Mono, monospace' }}>
                    Reset: {model.resetTime}
                  </span>
                )}
              </div>
            )}

            {model.status === 'decommissioned' && (
              <span style={{
                fontSize: '0.6rem',
                color: '#EF4444',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                Decommissioned
              </span>
            )}

            {model.status === 'error' && model.error && (
              <div style={{
                fontSize: '0.6rem',
                color: '#EF4444',
                maxWidth: '250px',
                textAlign: 'right',
                wordBreak: 'break-word',
                lineHeight: '1.3'
              }}>
                {model.error.length > 80 ? model.error.substring(0, 80) + '...' : model.error}
              </div>
            )}
          </div>
        ))}
      </div>
      </>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `
      }} />
      </>
      )}
    </div>
  );
}
