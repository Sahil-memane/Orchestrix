import React, { useState, useEffect, useRef } from 'react';
import nginxLogo from '../assets/images/nginix.png';
import postgresLogo from '../assets/images/postgre.png';
import redisLogo from '../assets/images/redis.png';
import workerLogo from '../assets/images/worker.png';

const tooltipData = {
  1: {
    title: "Clients / SDK",
    tech: "HTTP · REST · WebSocket",
    logoColor: "var(--border)",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-client"/></svg>,
    body: <>Any client — browser, mobile app, or backend service — submits tasks via the REST API. Each request carries a <code>type</code>, <code>payload</code>, and optional priority flag. Returns a <code>job_id</code> immediately for polling or SSE subscription.</>
  },
  2: {
    title: "NGINX Load Balancer",
    tech: ":80 / :443 · round-robin · TLS",
    logoColor: "#009639",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-nginx"/></svg>,
    body: <>Edge proxy that terminates TLS, applies rate limiting, and distributes traffic across both API servers via round-robin with <code>least_conn</code> fallback. Buffers bursts and handles connection keep-alive to reduce upstream load.</>
  },
  3: {
    title: "API Server 1",
    tech: "FastAPI · :8001 · uvicorn",
    logoColor: "#009688",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-fastapi"/></svg>,
    body: <>Validates JWT, writes a <code>PENDING</code> row to PostgreSQL, then <code>RPUSH</code>es the task ID into the appropriate Redis queue. Returns <code>202 Accepted</code> + <code>job_id</code> without waiting for task completion — fully non-blocking.</>
  },
  4: {
    title: "API Server 2",
    tech: "FastAPI · :8002 · uvicorn",
    logoColor: "#009688",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-fastapi"/></svg>,
    body: <>Identical horizontal replica of Server 1. Both servers share the same PostgreSQL instance and Redis. Adding more replicas only requires updating the NGINX <code>upstream</code> block — zero application code changes.</>
  },
  5: {
    title: "Redis Message Queue",
    tech: "3 priority lists · AOF persistence",
    logoColor: "#DC382C",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-redis"/></svg>,
    body: <>Three Redis lists provide natural priority routing. Workers <code>BLPOP queue:high queue:default queue:low</code> — Redis checks left to right, so high-priority tasks are always consumed first. AOF persistence prevents task loss on crash or restart.</>
  },
  6: {
    title: "Worker Pool (W1 · W2 · W3)",
    tech: "Python · 3 processes × 4 threads",
    logoColor: "#3776ab",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-python"/></svg>,
    body: <><strong>W1</strong> handles CPU/memory-intensive tasks. <strong>W2</strong> handles I/O and network calls. <strong>W3</strong> handles batch and file processing. Each picks up tasks via <code>BLPOP</code>, sets status to <code>RUNNING</code>, writes result, then marks <code>DONE</code> or <code>FAILED</code>.</>
  },
  7: {
    title: "Watchdog",
    tech: "supervisor · 30 s heartbeat scan",
    logoColor: "#e8a030",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-watchdog"/></svg>,
    body: <>Pings each worker's Redis heartbeat key every 30 s. If a worker misses 2 beats, Watchdog requeues its <code>STALLED</code> tasks to <code>queue:high</code>, restarts the process, and fires an alert. Prevents silent task loss from worker crashes.</>
  },
  8: {
    title: "PostgreSQL",
    tech: "persistent store · ACID · indexed",
    logoColor: "#336791",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-pg"/></svg>,
    body: <>Single source of truth for all tasks. Each row: <code>id · type · status · payload · worker_id · result · created_at · updated_at</code>. Status transitions are atomic. Compound index on <code>(status, created_at)</code> keeps dashboard queries instant even at scale.</>
  },
  9: {
    title: "Dashboard (React)",
    tech: "zustand · recharts · SSE · react-query",
    logoColor: "#20232a",
    logoSvg: <svg viewBox="0 0 40 40" style={{ width: '22px', height: '22px' }}><use href="#logo-react"/></svg>,
    body: <>Real-time ops dashboard. Subscribes to <code>/events</code> SSE for live task updates. Renders a Kanban board (pending → running → done), per-worker thread utilization bars, and queue depth line charts via recharts. State managed by zilch/useState.</>
  }
};

const ArchitectureVisualization = () => {
  const [activeMarker, setActiveMarker] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);

  const handleMarkerClick = (e, markerId) => {
    e.stopPropagation();
    if (activeMarker === markerId) {
      setActiveMarker(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      let top = rect.bottom - containerRect.top + 8;
      let left = rect.left - containerRect.left - 126; // Center the 280px tooltip (140px width offset, fine-tuned to 126px)
      
      // Keep tooltip bounded inside the container width
      const containerWidth = containerRect.width;
      if (left < 10) left = 10;
      if (left + 290 > containerWidth) left = containerWidth - 290;
      
      setTooltipPos({ top, left });
      setActiveMarker(markerId);
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMarker(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const activeData = activeMarker ? tooltipData[activeMarker] : null;

  return (
    <div className="architecture-diagram-light">
      <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '1150px', margin: '0 auto', overflow: 'visible' }}>
        <svg className="diagram" viewBox="0 0 900 950" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
          <defs>
            <marker id="ah" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L7,3 z" fill="var(--text-muted)"/>
            </marker>
            <marker id="ah-d" markerWidth="7" markerHeight="6" refX="5.5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L7,3 z" fill="var(--border)"/>
            </marker>

            <clipPath id="logo-clip">
              <rect width="40" height="40" rx="8" />
            </clipPath>

            {/* ══ TECH LOGO SYMBOLS ══ */}
            <symbol id="logo-nginx" viewBox="0 0 40 40">
              <image href={nginxLogo} width="40" height="40" clipPath="url(#logo-clip)" />
            </symbol>

            <symbol id="logo-fastapi" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="#009688"/>
              <path d="M22,5 L11,21 L19,21 L17,35 L29,19 L21,19 Z" fill="#fff"/>
            </symbol>

            <symbol id="logo-redis" viewBox="0 0 40 40">
              <image href={redisLogo} width="40" height="40" clipPath="url(#logo-clip)" />
            </symbol>

            <symbol id="logo-python" viewBox="0 0 40 40">
              <image href={workerLogo} width="40" height="40" clipPath="url(#logo-clip)" />
            </symbol>

            <symbol id="logo-pg" viewBox="0 0 40 40">
              <image href={postgresLogo} width="40" height="40" clipPath="url(#logo-clip)" />
            </symbol>

            <symbol id="logo-react" viewBox="0 0 40 40">
              <rect width="40" height="40" rx="8" fill="#20232a"/>
              <circle cx="20" cy="20" r="3" fill="#61dafb"/>
              <ellipse cx="20" cy="20" rx="13" ry="5" fill="none" stroke="#61dafb" strokeWidth="1.5"/>
              <ellipse cx="20" cy="20" rx="13" ry="5" fill="none" stroke="#61dafb" strokeWidth="1.5" transform="rotate(60 20 20)"/>
              <ellipse cx="20" cy="20" rx="13" ry="5" fill="none" stroke="#61dafb" strokeWidth="1.5" transform="rotate(120 20 20)"/>
            </symbol>

            <symbol id="logo-watchdog" viewBox="0 0 40 40">
              <rect width="40" height="40" rx="8" fill="#e8a030"/>
              <path d="M20,6 L32,10.5 L32,20 C32,26.5 27,31.5 20,34 C13,31.5 8,26.5 8,20 L8,10.5 Z" fill="rgba(255,255,255,0.2)"/>
              <path d="M20,6 L32,10.5 L32,20 C32,26.5 27,31.5 20,34 C13,31.5 8,26.5 8,20 L8,10.5 Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="20" cy="19" r="6" fill="none" stroke="#fff" strokeWidth="1.5"/>
              <line x1="20" y1="19" x2="25" y2="15" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
            </symbol>

            <symbol id="logo-client" viewBox="0 0 40 40">
              <rect width="40" height="40" rx="8" fill="var(--bg-input)"/>
              <circle cx="20" cy="14" r="5" fill="var(--text-primary)"/>
              <path d="M10,29 C10,23.5 14.5,21 20,21 C25.5,21 30,23.5 30,29" fill="none" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round"/>
            </symbol>
          </defs>

          {/* Outer Canvas Container */}
          <rect x="16" y="14" width="868" height="920" rx="6" fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth="1.2"/>
          <text x="34" y="34" fontFamily="var(--font-sans)" fontSize="10" fontWeight="600" fill="var(--text-muted)" letterSpacing="0.05em">SYSTEM ARCHITECTURE</text>
        {/* ══════════════════════════════════════════════════
             FLOW ARROWS ( sits behind nodes )
        ══════════════════════════════════════════════════ */}
        <line x1="208" y1="88" x2="320" y2="88" stroke="var(--border)" strokeWidth="1.4" markerEnd="url(#ah)"/>
        <text x="264" y="80" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-muted)" textAnchor="middle">HTTP requests</text>

        <path d="M450,168 L450,186 L241,186 L241,226" stroke="var(--border)" strokeWidth="1.4" fill="none" markerEnd="url(#ah)"/>
        <path d="M450,168 L450,186 L661,186 L661,226" stroke="var(--border)" strokeWidth="1.4" fill="none" markerEnd="url(#ah)"/>
        <text x="450" y="182" fontFamily="var(--font-sans)" fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontStyle="italic">round-robin</text>

        <path d="M241,334 L241,368 L310,368" stroke="var(--border)" strokeWidth="1.4" fill="none" markerEnd="url(#ah)"/>
        <path d="M661,334 L661,368 L610,368" stroke="var(--border)" strokeWidth="1.4" fill="none" markerEnd="url(#ah)"/>
        <text x="640" y="360" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--text-muted)">RPUSH</text>

        <line x1="450" y1="480" x2="450" y2="524" stroke="var(--border)" strokeWidth="1.4" markerEnd="url(#ah)"/>
        <text x="464" y="507" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--text-muted)">BLPOP</text>

        <line x1="450" y1="682" x2="450" y2="720" stroke="var(--border)" strokeWidth="1.4" markerEnd="url(#ah)"/>
        <text x="464" y="706" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-muted)">Write result</text>

        <line x1="450" y1="808" x2="450" y2="848" stroke="var(--border)" strokeWidth="1.4" markerEnd="url(#ah)"/>
        <text x="464" y="833" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-muted)">SSE / polling</text>

        {/* ══════════════════════════════════════════════════
             NODE 1 — CLIENTS
        ══════════════════════════════════════════════════ */}
        <g id="node-client">
          <rect x="44" y="54" width="162" height="68" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2" strokeDasharray="5,3"/>
          <use href="#logo-client" x="56" y="65" width="36" height="36"/>
          <text x="104" y="80" fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="600" fill="var(--text-primary)">Clients / SDK</text>
          <text x="104" y="96" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-secondary)">HTTP · REST · WS</text>
          <text x="104" y="111" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--text-muted)">Python · JS · cURL</text>
        </g>

        {/* ══════════════════════════════════════════════════
             NODE 2 — NGINX
        ══════════════════════════════════════════════════ */}
        <g id="node-nginx">
          <rect x="320" y="46" width="260" height="120" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-nginx" x="336" y="62" width="48" height="48"/>
          <text x="398" y="82" fontFamily="var(--font-sans)" fontSize="13" fontWeight="700" fill="var(--text-primary)">NGINX</text>
          <text x="398" y="98" fontFamily="var(--font-sans)" fontSize="11" fill="var(--text-secondary)">Load Balancer</text>
          <text x="398" y="114" fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-muted)">:80 / :443 · TLS</text>
          
          <rect x="336" y="120" width="58" height="18" rx="4" className="diag-badge-green" strokeWidth="0.8"/>
          <text x="365" y="129" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="8" className="diag-badge-green-text" textAnchor="middle">upstream</text>
          
          <rect x="400" y="120" width="72" height="18" rx="4" className="diag-badge-green" strokeWidth="0.8"/>
          <text x="420" y="129" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="8" className="diag-badge-green-text" textAnchor="middle">least_conn</text>
          
          <rect x="478" y="120" width="68" height="18" rx="4" className="diag-badge-green" strokeWidth="0.8"/>
          <text x="496" y="129" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="8" className="diag-badge-green-text" textAnchor="middle">keepalive</text>
        </g>

        {/* ══════════════════════════════════════════════════
             NODE 3 — API SERVER 1
        ══════════════════════════════════════════════════ */}
        <g id="node-api1">
          <rect x="96" y="228" width="290" height="104" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-fastapi" x="112" y="244" width="44" height="44"/>
          <text x="170" y="262" fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="700" fill="var(--text-primary)">API Server 1</text>
          <text x="170" y="278" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--text-secondary)">FastAPI · port :8001</text>
          <text x="170" y="293" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--text-muted)">uvicorn · 4 async workers</text>
          
          <rect x="112" y="300" width="48" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="136" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">JWT auth</text>
          
          <rect x="166" y="300" width="64" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="198" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">rate-limit</text>
          
          <rect x="236" y="300" width="56" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="264" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">RPUSH</text>
          
          <rect x="298" y="300" width="60" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="328" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">202 async</text>
        </g>

        {/* ══════════════════════════════════════════════════
             NODE 4 — API SERVER 2
        ══════════════════════════════════════════════════ */}
        <g id="node-api2">
          <rect x="516" y="228" width="290" height="104" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-fastapi" x="532" y="244" width="44" height="44"/>
          <text x="590" y="262" fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="700" fill="var(--text-primary)">API Server 2</text>
          <text x="590" y="278" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--text-secondary)">FastAPI · port :8002</text>
          <text x="590" y="293" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--text-muted)">uvicorn · 4 async workers</text>
          
          <rect x="532" y="300" width="48" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="556" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">JWT auth</text>
          
          <rect x="586" y="300" width="64" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="618" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">rate-limit</text>
          
          <rect x="656" y="300" width="56" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="684" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">RPUSH</text>
          
          <rect x="718" y="300" width="60" height="16" rx="3" className="diag-badge-teal" strokeWidth="0.8"/>
          <text x="748" y="308" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-teal-text" textAnchor="middle">202 async</text>
        </g>

        {/* ══════════════════════════════════════════════════
             NODE 5 — REDIS Message Queue
        ══════════════════════════════════════════════════ */}
        <g id="node-redis">
          <rect x="96" y="352" width="710" height="126" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-redis" x="112" y="368" width="48" height="48"/>
          <text x="174" y="388" fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="700" fill="var(--text-primary)">Redis Message Queue</text>
          <text x="174" y="404" fontFamily="var(--font-sans)" fontSize="10" fill="var(--text-secondary)">In-memory · AOF persistence · 3 priority lanes</text>

          {/* High Priority Lane Badge */}
          <rect x="112" y="428" width="206" height="36" rx="6" className="diag-badge-red" strokeWidth="1.2"/>
          <rect x="116" y="432" width="10" height="10" rx="2" fill="var(--status-failed)"/>
          <text x="132" y="441" fontFamily="var(--font-sans)" fontSize="9" fontWeight="600" fill="var(--status-failed)">HIGH PRIORITY</text>
          <text x="132" y="457" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="500" fill="var(--status-failed)">queue:high</text>

          {/* Default Lane Badge */}
          <rect x="332" y="428" width="220" height="36" rx="6" className="diag-badge-orange" strokeWidth="1.2"/>
          <rect x="336" y="432" width="10" height="10" rx="2" fill="var(--status-pending)"/>
          <text x="352" y="441" fontFamily="var(--font-sans)" fontSize="9" fontWeight="600" fill="var(--status-pending)">DEFAULT</text>
          <text x="352" y="457" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="500" fill="var(--status-pending)">queue:default</text>

          {/* Low Priority Lane Badge */}
          <rect x="566" y="428" width="214" height="36" rx="6" className="diag-badge-green" strokeWidth="1.2"/>
          <rect x="570" y="432" width="10" height="10" rx="2" fill="var(--status-completed)"/>
          <text x="586" y="441" fontFamily="var(--font-sans)" fontSize="9" fontWeight="600" fill="var(--status-completed)">BACKGROUND</text>
          <text x="586" y="457" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="500" fill="var(--status-completed)">queue:low</text>
        </g>

        {/* ══════════════════════════════════════════════════
             WORKER POOL CONTAINER
        ══════════════════════════════════════════════════ */}
        <rect x="64" y="526" width="594" height="154" rx="6" fill="var(--bg-secondary)" stroke="var(--border)" strokeWidth="1" strokeDasharray="5,3"/>
        <text x="84" y="546" fontFamily="var(--font-sans)" fontSize="9.5" fontWeight="600" fill="var(--text-muted)" letterSpacing="0.05em">WORKER POOL · Python · multi-threading</text>

        {/* NODE 6 — WORKER 1 */}
        <g id="node-w1">
          <rect x="78" y="550" width="174" height="116" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-python" x="90" y="562" width="38" height="38"/>
          <text x="140" y="578" fontFamily="var(--font-sans)" fontSize="12" fontWeight="700" fill="var(--text-primary)">Worker 1</text>
          <text x="140" y="593" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-secondary)">4 threads · CPU tasks</text>
          
          <rect x="90" y="610" width="62" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="121" y="617.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">heartbeat</text>
          
          <rect x="158" y="610" width="68" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="192" y="617.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">retry logic</text>
          
          <rect x="90" y="630" width="136" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="158" y="637.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">graceful shutdown · SIGTERM</text>
        </g>

        {/* NODE 7 — WORKER 2 */}
        <g id="node-w2">
          <rect x="272" y="550" width="174" height="116" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-python" x="284" y="562" width="38" height="38"/>
          <text x="334" y="578" fontFamily="var(--font-sans)" fontSize="12" fontWeight="700" fill="var(--text-primary)">Worker 2</text>
          <text x="334" y="593" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-secondary)">4 threads · I/O tasks</text>
          
          <rect x="284" y="610" width="62" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="315" y="617.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">heartbeat</text>
          
          <rect x="352" y="610" width="68" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="386" y="617.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">retry logic</text>
          
          <rect x="284" y="630" width="136" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="352" y="637.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">graceful shutdown · SIGTERM</text>
        </g>

        {/* NODE 8 — WORKER 3 */}
        <g id="node-w3">
          <rect x="466" y="550" width="174" height="116" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-python" x="478" y="562" width="38" height="38"/>
          <text x="528" y="578" fontFamily="var(--font-sans)" fontSize="12" fontWeight="700" fill="var(--text-primary)">Worker 3</text>
          <text x="528" y="593" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-secondary)">4 threads · Batch tasks</text>
          
          <rect x="478" y="610" width="62" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="509" y="617.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">heartbeat</text>
          
          <rect x="546" y="610" width="68" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="580" y="617.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">retry logic</text>
          
          <rect x="478" y="630" width="136" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
          <text x="546" y="637.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="7.5" className="diag-badge-indigo-text" textAnchor="middle">graceful shutdown · SIGTERM</text>
        </g>

        {/* NODE 9 — WATCHDOG */}
        <g id="node-watchdog">
          <rect x="674" y="526" width="162" height="154" rx="6" fill="var(--bg-card)" stroke="var(--status-pending)" strokeWidth="1.4"/>
          <use href="#logo-watchdog" x="686" y="538" width="36" height="36"/>
          <text x="734" y="552" fontFamily="var(--font-sans)" fontSize="12" fontWeight="700" fill="var(--text-primary)">Watchdog</text>
          <text x="734" y="568" fontFamily="var(--font-sans)" fontSize="9.5" fill="var(--text-secondary)">Heartbeat · 30 s</text>
          
          <rect x="683" y="584" width="132" height="15" rx="3" className="diag-badge-orange" strokeWidth="0.8"/>
          <text x="749" y="591.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="8" className="diag-badge-orange-text" textAnchor="middle">ping W1 / W2 / W3</text>
          
          <rect x="683" y="604" width="132" height="15" rx="3" className="diag-badge-orange" strokeWidth="0.8"/>
          <text x="749" y="611.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="8" className="diag-badge-orange-text" textAnchor="middle">requeue stalled tasks</text>
          
          <rect x="683" y="624" width="132" height="15" rx="3" className="diag-badge-orange" strokeWidth="0.8"/>
          <text x="749" y="631.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="8" className="diag-badge-orange-text" textAnchor="middle">restart dead workers</text>
          
          <rect x="683" y="644" width="132" height="15" rx="3" className="diag-badge-orange" strokeWidth="0.8"/>
          <text x="749" y="651.5" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize="8" className="diag-badge-orange-text" textAnchor="middle">alert on repeated fail</text>
        </g>
        <path d="M674,603 L658,603" stroke="var(--status-pending)" strokeWidth="1.2" strokeDasharray="4,3" fill="none" markerEnd="url(#ah-d)"/>

        {/* ══════════════════════════════════════════════════
             NODE 10 — POSTGRESQL
        ══════════════════════════════════════════════════ */}
        <g id="node-pg">
          <rect x="64" y="722" width="772" height="84" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-pg" x="80" y="738" width="46" height="46"/>
          <text x="138" y="756" fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="700" fill="var(--text-primary)">PostgreSQL</text>
          <text x="138" y="771" fontFamily="var(--font-sans)" fontSize="10" fill="var(--text-secondary)">Persistent store · ACID · indexed on status + created_at</text>
          
          <g fontFamily="var(--font-mono)" fontSize="8.5">
            <rect x="80" y="782" width="26" height="16" rx="3" className="diag-badge-grey" strokeWidth="0.8"/>
            <text x="93" y="790" dominantBaseline="middle" className="diag-badge-grey-text" textAnchor="middle">id</text>
            
            <rect x="112" y="782" width="30" height="16" rx="3" className="diag-badge-grey" strokeWidth="0.8"/>
            <text x="127" y="790" dominantBaseline="middle" className="diag-badge-grey-text" textAnchor="middle">type</text>
            
            <rect x="148" y="782" width="40" height="16" rx="3" className="diag-badge-green" strokeWidth="0.8"/>
            <text x="168" y="790" dominantBaseline="middle" className="diag-badge-green-text" textAnchor="middle">status</text>
            
            <rect x="194" y="782" width="48" height="16" rx="3" className="diag-badge-grey" strokeWidth="0.8"/>
            <text x="218" y="790" dominantBaseline="middle" className="diag-badge-grey-text" textAnchor="middle">payload</text>
            
            <rect x="248" y="782" width="56" height="16" rx="3" className="diag-badge-grey" strokeWidth="0.8"/>
            <text x="276" y="790" dominantBaseline="middle" className="diag-badge-grey-text" textAnchor="middle">worker_id</text>
            
            <rect x="310" y="782" width="40" height="16" rx="3" className="diag-badge-grey" strokeWidth="0.8"/>
            <text x="330" y="790" dominantBaseline="middle" className="diag-badge-grey-text" textAnchor="middle">result</text>
            
            <rect x="356" y="782" width="58" height="16" rx="3" className="diag-badge-grey" strokeWidth="0.8"/>
            <text x="385" y="790" dominantBaseline="middle" className="diag-badge-grey-text" textAnchor="middle">created_at</text>
            
            <rect x="420" y="782" width="60" height="16" rx="3" className="diag-badge-grey" strokeWidth="0.8"/>
            <text x="450" y="790" dominantBaseline="middle" className="diag-badge-grey-text" textAnchor="middle">updated_at</text>
          </g>
        </g>

        {/* ══════════════════════════════════════════════════
             NODE 11 — DASHBOARD
        ══════════════════════════════════════════════════ */}
        <g id="node-dash">
          <rect x="64" y="850" width="772" height="68" rx="6" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.2"/>
          <use href="#logo-react" x="80" y="863" width="42" height="42"/>
          <text x="136" y="879" fontFamily="var(--font-sans)" fontSize="12.5" fontWeight="700" fill="var(--text-primary)">Dashboard</text>
          <text x="136" y="895" fontFamily="var(--font-sans)" fontSize="10" fill="var(--text-secondary)">React · Kanban board · worker stats · queue depth charts</text>
          
          <g fontFamily="var(--font-mono)" fontSize="8">
            <rect x="308" y="863" width="50" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
            <text x="333" y="870.5" dominantBaseline="middle" className="diag-badge-indigo-text" textAnchor="middle">zustand</text>
            
            <rect x="364" y="863" width="54" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
            <text x="391" y="870.5" dominantBaseline="middle" className="diag-badge-indigo-text" textAnchor="middle">recharts</text>
            
            <rect x="424" y="863" width="50" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
            <text x="449" y="870.5" dominantBaseline="middle" className="diag-badge-indigo-text" textAnchor="middle">SSE client</text>
            
            <rect x="480" y="863" width="68" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
            <text x="514" y="870.5" dominantBaseline="middle" className="diag-badge-indigo-text" textAnchor="middle">react-query</text>
            
            <rect x="554" y="863" width="68" height="15" rx="3" className="diag-badge-indigo" strokeWidth="0.8"/>
            <text x="588" y="870.5" dominantBaseline="middle" className="diag-badge-indigo-text" textAnchor="middle">TailwindCSS</text>
          </g>
        </g>

        {/* ══════════════════════════════════════════════════
             NATIVE SVG INTERACTIVE MARKERS
        ══════════════════════════════════════════════════ */}
        {[
          { id: 1, x: 206, y: 54, anchor: "node-client" },
          { id: 2, x: 580, y: 46, anchor: "node-nginx" },
          { id: 3, x: 386, y: 228, anchor: "node-api1" },
          { id: 4, x: 806, y: 228, anchor: "node-api2" },
          { id: 5, x: 806, y: 352, anchor: "node-redis" },
          { id: 6, x: 252, y: 550, anchor: "node-w1" },
          { id: 7, x: 836, y: 526, anchor: "node-watchdog" },
          { id: 8, x: 836, y: 722, anchor: "node-pg" },
          { id: 9, x: 836, y: 850, anchor: "node-dash" }
        ].map((marker) => (
          <g 
            key={marker.id}
            className={`diagram-marker ${activeMarker === marker.id ? 'active' : ''}`}
            transform={`translate(${marker.x}, ${marker.y})`}
            onClick={(e) => handleMarkerClick(e, marker.id)}
          >
            <circle r="11" />
            <text textAnchor="middle" dominantBaseline="central">{marker.id}</text>
          </g>
        ))}
      </svg>

      {/* Floating Tooltip relative to selected marker */}
      {activeData && (
        <div 
          className="diagram-tooltip" 
          style={{ 
            top: `${tooltipPos.top}px`, 
            left: `${tooltipPos.left}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="tip-close" onClick={() => setActiveMarker(null)}>✕</button>
          <div className="tip-head">
            <div className="tip-logo" style={{ backgroundColor: activeData.logoColor }}>
              {activeData.logoSvg}
            </div>
            <div>
              <div className="tip-title">{activeData.title}</div>
              <div className="tip-tech">{activeData.tech}</div>
            </div>
          </div>
          <div className="tip-body">
            {activeData.body}
          </div>
        </div>
      )}

      {/* Legend below the diagram */}
      <div className="legend" style={{ marginTop: '16px', display: 'flex', gap: '24px', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '26px', borderTop: '1.5px solid var(--text-muted)' }}></div>
          Data flow
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div style={{ width: '26px', borderTop: '1.5px dashed var(--border)' }}></div>
          Status / feedback
        </div>
      </div>
    </div>
  </div>
  );
};

export default ArchitectureVisualization;
