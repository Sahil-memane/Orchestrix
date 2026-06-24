import React, { useState, useEffect } from 'react';
import { ChevronDown, Zap, Shield, GitBranch, Layers } from 'lucide-react';
import ArchitectureVisualization from './ArchitectureVisualization';

const colors = {
  bg: 'var(--bg-primary)',
  bgSecondary: 'var(--bg-secondary)',
  border: 'var(--border)',
  text: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  accent: 'var(--accent)',
  accentLight: 'var(--accent-light)',
  shadow: 'rgba(0, 0, 0, 0.25)',
  statusProcessing: 'var(--status-processing)',
  statusPending: 'var(--status-pending)',
  statusCompleted: 'var(--status-completed)',
  typeData: 'var(--tag-data)',
  typeImage: 'var(--tag-image)'
};

// ─── 3D ARCHITECTURE LAYER COMPONENT ──────────────────────────────────────
const Architecture3DLayer = ({ layer, isSelected, onSelect, colors, delay }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={() => onSelect(layer.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: colors.bgSecondary,
        border: `2px solid ${isSelected ? colors.accent : colors.border}`,
        borderRadius: '12px',
        padding: '20px',
        margin: '16px 0',
        cursor: 'pointer',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isSelected
          ? 'perspective(1000px) rotateX(-5deg) translateZ(20px)'
          : isHovered
          ? 'perspective(1000px) rotateX(-2deg) translateZ(10px) scale(1.02)'
          : 'perspective(1000px) rotateX(0deg) translateZ(0px)',
        boxShadow: isSelected
          ? `0 20px 40px ${colors.accent}40, inset 0 1px 3px rgba(255, 255, 255, 0.1)`
          : isHovered
          ? `0 15px 30px rgba(0, 0, 0, 0.3), inset 0 1px 3px rgba(255, 255, 255, 0.05)`
          : colors.shadow,
        borderColor: isSelected ? colors.accent : isHovered ? colors.accent : colors.border,
        animation: `slideIn 0.6s ease-out ${delay}s both`,
        position: 'relative'
      }}
    >
      {/* Gradient accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          borderRadius: '12px 12px 0 0',
          background: `linear-gradient(90deg, ${layer.color}, ${colors.accent})`,
          opacity: isSelected ? 1 : 0.5,
          transition: 'opacity 200ms ease',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        {/* Icon/Indicator */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            background: `${layer.color}20`,
            border: `2px solid ${layer.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0,
            transition: 'all 200ms ease',
            transform: isSelected ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {layer.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: '700',
              color: layer.color,
              margin: '0 0 8px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {layer.name}
          </h3>

          <p
            style={{
              fontSize: '13px',
              color: colors.textSecondary,
              margin: '0 0 12px 0',
              lineHeight: '1.5',
            }}
          >
            {layer.description}
          </p>

          {/* Components Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '8px',
            }}
          >
            {layer.components.map((comp, idx) => (
              <div
                key={idx}
                style={{
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: colors.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'all 200ms ease',
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {comp}
              </div>
            ))}
          </div>
        </div>

        {/* Expand Icon */}
        <ChevronDown
          size={20}
          color={colors.accent}
          style={{
            transition: 'transform 300ms ease',
            transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)',
            marginTop: '4px',
          }}
        />
      </div>

      {/* Details (when selected) */}
      {isSelected && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: `1px solid ${colors.border}`,
            animation: 'fadeIn 300ms ease',
          }}
        >
          <h4
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textSecondary,
              margin: '0 0 12px 0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            📋 Details
          </h4>
          <p
            style={{
              fontSize: '12px',
              color: colors.text,
              lineHeight: '1.6',
              margin: 0,
            }}
          >
            {layer.details}
          </p>

          {/* Additional Info */}
          {layer.additionalInfo && (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: `1px solid ${colors.border}`,
              }}
            >
              {layer.additionalInfo}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── DATA FLOW VISUALIZATION ─────────────────────────────────────────────
const DataFlowVisualization = ({ colors }) => {
  const [animatingIndex, setAnimatingIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatingIndex(prev => (prev + 1) % 7);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const flows = [
    {
      from: 'Client',
      to: 'NGINX',
      label: 'HTTP POST /tasks',
      data: '{"type": "image_processing", "payload": {...}}',
    },
    {
      from: 'NGINX',
      to: 'API Servers',
      label: 'Round-robin load balance',
      data: 'Request → api1 or api2',
    },
    {
      from: 'API Servers',
      to: 'Redis Queue',
      label: 'RPUSH task:queue:high',
      data: 'task_id → queue',
    },
    {
      from: 'Redis Queue',
      to: 'Worker Pool',
      label: 'BLPOP (blocking)',
      data: 'Workers wait for tasks',
    },
    {
      from: 'Worker Pool',
      to: 'PostgreSQL',
      label: 'Write result',
      data: 'UPDATE tasks SET status=completed',
    },
    {
      from: 'PostgreSQL',
      to: 'Dashboard',
      label: 'SSE / Polling',
      data: 'Real-time updates',
    },
    {
      from: 'Dashboard',
      to: 'Client',
      label: 'Live UI update',
      data: 'Kanban, charts refresh',
    },
  ];

  return (
    <div
      style={{
        background: colors.bgSecondary,
        border: `2px dashed ${colors.accent}`,
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px',
      }}
    >
      <h2
        style={{
          fontSize: '20px',
          fontWeight: '700',
          color: colors.text,
          margin: '0 0 24px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <Layers size={24} color={colors.accent} />
        Data Flow Animation
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
        {flows.map((flow, idx) => (
          <div
            key={idx}
            style={{
              background: colors.bg,
              border: `2px solid ${animatingIndex === idx ? colors.accent : colors.border}`,
              borderRadius: '12px',
              padding: '16px',
              transition: 'all 300ms ease',
              transform:
                animatingIndex === idx
                  ? 'perspective(1000px) scale(1.05) rotateY(5deg)'
                  : 'perspective(1000px) scale(1) rotateY(0deg)',
              boxShadow:
                animatingIndex === idx
                  ? `0 0 20px ${colors.accent}60, inset 0 1px 3px rgba(255, 255, 255, 0.1)`
                  : colors.shadow,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: colors.textSecondary,
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Step {idx + 1}
            </div>

            <div
              style={{
                fontSize: '13px',
                fontWeight: '600',
                color: colors.text,
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>{flow.from}</span>
              <Zap size={14} color={colors.accent} />
              <span>{flow.to}</span>
            </div>

            <div
              style={{
                fontSize: '12px',
                color: colors.accent,
                fontWeight: '500',
                marginBottom: '8px',
              }}
            >
              {flow.label}
            </div>

            <div
              style={{
                fontSize: '11px',
                color: colors.textSecondary,
                background: colors.bgSecondary,
                padding: '8px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                border: `1px solid ${colors.border}`,
              }}
            >
              {flow.data}
            </div>

            {animatingIndex === idx && (
              <div
                style={{
                  marginTop: '8px',
                  height: '2px',
                  background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
                  borderRadius: '1px',
                  animation: 'flowPulse 1s ease-in-out infinite',
                }}
              />
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes flowPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ─── MAIN ARCHITECTURE EXPLORATION COMPONENT ─────────────────────────────
const ArchitectureExploration = () => {
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [subView, setSubView] = useState('diagram');

  const architectureLayers = [
    {
      id: 'client',
      name: 'CLIENT LAYER',
      icon: '👤',
      description: 'Frontend entry points for task submission and monitoring',
      color: colors.statusProcessing,
      components: ['curl / Python SDK', 'React Dashboard', 'CLI Tool'],
      details:
        'Users interact with Orchestrix through three interfaces: command-line for simple submissions, Python SDK for programmatic access, and the React dashboard for real-time monitoring and visualization.',
      additionalInfo: (
        <div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '8px' }}>
            <strong>Technology:</strong> curl, Python requests, React 18 + Vite
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>
            <strong>Endpoints Called:</strong> POST /tasks, GET /tasks/:id, GET /metrics, GET /stream/tasks
          </div>
        </div>
      ),
    },
    {
      id: 'lb',
      name: 'LOAD BALANCER',
      icon: '🌉',
      description: 'Distributes HTTP traffic across API server instances',
      color: colors.accent,
      components: ['NGINX', 'Port 80', 'Health Checks'],
      details:
        'NGINX performs round-robin load balancing across multiple API server instances. Includes built-in health checking to route around failed servers.',
      additionalInfo: (
        <div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '8px' }}>
            <strong>Config:</strong> Upstream pool with api1:8001, api2:8002
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>
            <strong>Feature:</strong> Sticky sessions support + rate limiting (future)
          </div>
        </div>
      ),
    },
    {
      id: 'api',
      name: 'API SERVER POOL',
      icon: '⚙️',
      description: 'FastAPI microservices handling task submission and status queries',
      color: colors.statusPending,
      components: [
        'FastAPI Framework',
        'Uvicorn ASGI',
        'SQLAlchemy ORM',
        'Pydantic Validation',
      ],
      details:
        'Multiple FastAPI instances run in parallel behind NGINX. Each receives task submissions, stores metadata in PostgreSQL, and enqueues task IDs to Redis. Stateless by design — can be scaled horizontally.',
      additionalInfo: (
        <div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '8px' }}>
            <strong>Key Routes:</strong> POST /tasks, GET /tasks/{'{id}'}, GET /metrics, GET /stream/tasks
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>
            <strong>Scaling:</strong> Stateless → add replicas without code changes
          </div>
        </div>
      ),
    },
    {
      id: 'queue',
      name: 'MESSAGE QUEUE (Redis)',
      icon: '📦',
      description: 'Priority-aware task queue with 3 lanes and fast atomicity',
      color: colors.typeData,
      components: [
        'task:queue:high',
        'task:queue:default',
        'task:queue:low',
        'Heartbeat keys',
      ],
      details:
        'Redis Lists implement 3 priority lanes. Workers BLPOP from high→default→low in order. No task starvation. TTL auto-cleanup. Atomicity at Redis server level — no coordination needed.',
      additionalInfo: (
        <div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '8px' }}>
            <strong>Command:</strong> BLPOP task:queue:high task:queue:default task:queue:low 5
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>
            <strong>Advantage:</strong> Zero CPU spin-wait, instant atomic dequeue
          </div>
        </div>
      ),
    },
    {
      id: 'workers',
      name: 'WORKER POOL',
      icon: '🔨',
      description: 'Concurrent task executors with multi-threading and fault recovery',
      color: colors.statusCompleted,
      components: [
        'Python Process',
        'ThreadPoolExecutor (4 threads)',
        'Task Handlers',
        'Heartbeat Daemon',
      ],
      details:
        'Each worker spawns 4 threads via ThreadPoolExecutor. BLPOP blocks until a task is available, then submits to thread pool. Threads execute independently without shared state. Heartbeat sent every 5s for watchdog monitoring.',
      additionalInfo: (
        <div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '8px' }}>
            <strong>Concurrency:</strong> 4 threads/worker × N workers = up to 4N parallel tasks
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>
            <strong>Fault Tolerance:</strong> Heartbeat → Watchdog detects crash → Re-queue in &lt;60s
          </div>
        </div>
      ),
    },
    {
      id: 'db',
      name: 'PERSISTENT STORE (PostgreSQL)',
      icon: '💾',
      description: 'Single source of truth for all task metadata and results',
      color: colors.typeImage,
      components: [
        'tasks table',
        'JSONB payload',
        'Indexes (status, created_at)',
        'Transactions',
      ],
      details:
        'PostgreSQL stores the authoritative record of every task: metadata, payloads, results, timings, errors, retry counts. Workers update status atomically. Supports full transaction isolation.',
      additionalInfo: (
        <div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '8px' }}>
            <strong>Schema:</strong> id, type, status, payload, result, worker_id, retry_count, timestamps
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>
            <strong>Indexes:</strong> status (fast queries), created_at DESC (recent tasks)
          </div>
        </div>
      ),
    },
    {
      id: 'dashboard',
      name: 'DASHBOARD (React)',
      icon: '📊',
      description: 'Real-time visualization of system state and task execution',
      color: colors.accent,
      components: [
        'Kanban Columns',
        'Worker Cards',
        'Queue Depth Chart',
        'Status Breakdown',
      ],
      details:
        'React dashboard subscribes to SSE stream (/stream/tasks) for instant updates. Displays Kanban board, worker health, queue metrics. Dark mode, 3D hover effects, responsive design.',
      additionalInfo: (
        <div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginBottom: '8px' }}>
            <strong>Tech:</strong> React 18, Vite, Recharts, CSS Variables
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary }}>
            <strong>Updates:</strong> SSE for events, polling for metrics (2.5s interval)
          </div>
        </div>
      ),
    },
  ];

  return (
    <div
      className="architecture-black-theme"
      style={{
        background: 'transparent',
        minHeight: 'calc(100vh - var(--header-height) - 24px)',
        padding: '24px',
        transition: 'background-color 300ms ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '1150px', marginBottom: '24px' }}>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '800',
            color: colors.accent,
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
          }}
        >
          System Architecture
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: colors.textSecondary,
            margin: 0,
            maxWidth: '800px',
            lineHeight: '1.5',
          }}
        >
          Orchestrix is a distributed task execution system composed of 7 independent layers. Below is the interactive task execution pipeline diagram showing active channels and markers.
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '1150px' }}>
        <ArchitectureVisualization />
      </div>

      {/* Global Styles */}
      <style>{`
        * {
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

// ─── PRINCIPLE CARD ──────────────────────────────────────────────────────
const PrincipleCard = ({ icon, title, description, colors }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: colors.bgSecondary,
        border: `2px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered
          ? 'perspective(1000px) rotateX(-3deg) rotateY(2deg) translateZ(10px) scale(1.02)'
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
        boxShadow: isHovered
          ? `0 20px 40px ${colors.accent}30, inset 0 1px 3px rgba(255, 255, 255, 0.1)`
          : colors.shadow,
        borderColor: isHovered ? colors.accent : colors.border,
      }}
    >
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>{icon}</div>
      <h3
        style={{
          fontSize: '16px',
          fontWeight: '700',
          color: colors.text,
          margin: '0 0 8px 0',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: '13px',
          color: colors.textSecondary,
          margin: 0,
          lineHeight: '1.6',
        }}
      >
        {description}
      </p>
    </div>
  );
};

export default ArchitectureExploration;
