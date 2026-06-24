import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Settings, 
  Activity, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Terminal, 
  Sun, 
  Moon, 
  Plus, 
  Server,
  Layers,
  Database
} from 'lucide-react';
import { fetchMetrics, fetchTasks, submitTask, getSSEUrl, resetCluster } from './api';
import tasksPool from './tasks_pool.json';
import ArchitectureExploration from './components/ArchitectureExploration';

function App() {
  const [theme, setTheme] = useState(() => {
    return 'dark';
  });

  const [activeTab, setActiveTab] = useState('dashboard');

  const [metrics, setMetrics] = useState({
    queue_depth: { high: 0, default: 0, low: 0 },
    active_workers: 0,
    workers: [],
    tasks_per_minute: 0,
    status_counts: { pending: 0, processing: 0, completed: 0, failed: 0, retrying: 0, cancelled: 0 }
  });

  const [tasks, setTasks] = useState([]);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [taskType, setTaskType] = useState('data_transform');
  const [taskPriority, setTaskPriority] = useState('default');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const consoleRef = useRef(null);

  // Apply theme to HTML tag
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Telemetry Console Logger
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [...prev.slice(-99), { timestamp, message, type }]);
  };

  // Scroll Console
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [consoleLogs]);

  // Real-time ticking timer for elapsed processing durations
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial tasks and metrics on mount (and clean DB)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        addLog("Initializing telemetry link... Auto-cleaning task database.", "info");
        await resetCluster();
        
        const initialTasks = await fetchTasks({ limit: 40 });
        setTasks(initialTasks);
        
        const initialMetrics = await fetchMetrics();
        setMetrics(initialMetrics);
        addLog("Cluster clean reset completed. Node status: READY.", "success");
      } catch (err) {
        addLog(`Cluster connection error: ${err.message}. Check backend API.`, "error");
      }
    };

    loadInitialData();
  }, []);

  // Poll metrics every 2.5s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const updatedMetrics = await fetchMetrics();
        setMetrics(updatedMetrics);
      } catch (err) {
        // Suppress background poll logs
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // SSE stream listener
  useEffect(() => {
    const sseUrl = getSSEUrl();
    addLog("Opening real-time SSE telemetry channel...", "info");
    
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      addLog("SSE stream connected.", "success");
    };

    eventSource.addEventListener('task_update', (e) => {
      try {
        const taskUpdate = JSON.parse(e.data);
        
        setTasks(prevTasks => {
          const exists = prevTasks.some(t => t.id === taskUpdate.task_id);
          if (exists) {
            return prevTasks.map(t => t.id === taskUpdate.task_id ? { ...t, ...taskUpdate, id: taskUpdate.task_id } : t);
          } else {
            return [{ ...taskUpdate, id: taskUpdate.task_id }, ...prevTasks];
          }
        });

        const workerText = taskUpdate.worker_id ? ` via ${taskUpdate.worker_id.split(':')[0]}` : '';
        const priorityTag = `[${taskUpdate.priority.toUpperCase()}]`;
        
        let type = 'info';
        if (taskUpdate.status === 'completed') type = 'success';
        else if (taskUpdate.status === 'failed') type = 'error';
        else if (taskUpdate.status === 'retrying') type = 'warning';

        addLog(
          `Task ${taskUpdate.task_id.substring(0, 8)} (${taskUpdate.type}) -> ${taskUpdate.status.toUpperCase()}${workerText} ${priorityTag}`,
          type
        );
      } catch (err) {
        // SSE parsing issue
      }
    });

    eventSource.onerror = () => {
      addLog("Stream interrupted. Re-connecting to transport...", "warning");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Submit task manually
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);
    
    let parsedPayload = {};
    if (taskType === 'image_processing') {
      parsedPayload = { width: 1024, height: 768, sleep_seconds: 1.5, compression: "lossless" };
    } else if (taskType === 'email_send') {
      parsedPayload = { recipient: "manual_user@orchestrix.io", subject: "Manual Task Alert", sleep_seconds: 1.0 };
    } else {
      parsedPayload = { records: 2500, operation: "normalization", sleep_seconds: 2.0 };
    }

    try {
      const response = await submitTask({
        type: taskType,
        priority: taskPriority,
        payload: parsedPayload
      });
      addLog(`Dispatched manual task ${response.task_id.substring(0, 8)} to queue`, "info");
    } catch (err) {
      setSubmitError(err.message);
      addLog(`Task submission failed: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk Dispatch Handler
  const handleBulkDispatch = async (count) => {
    addLog(`Selecting and queueing ${count} random tasks from pool...`, "info");
    const selected = [];
    for (let i = 0; i < count; i++) {
      const task = tasksPool[Math.floor(Math.random() * tasksPool.length)];
      selected.push(task);
    }

    // Submit in batches of 25 to prevent HTTP connection starvation
    const batchSize = 25;
    let submittedCount = 0;
    
    for (let i = 0; i < selected.length; i += batchSize) {
      const batch = selected.slice(i, i + batchSize);
      await Promise.all(batch.map(async (task) => {
        try {
          await submitTask(task);
          submittedCount++;
        } catch (err) {
          // Suppress individual errors
        }
      }));
      // sleep a tiny bit to space out UI updates
      await new Promise(r => setTimeout(r, 60));
    }
    addLog(`Bulk dispatch complete. Queued ${submittedCount}/${count} tasks.`, "success");
  };

  // Clear Database manual handler
  const handleClearDatabase = async () => {
    try {
      addLog("Requesting database and queue reset...", "warning");
      await resetCluster();
      setTasks([]);
      // Reload metrics
      const freshMetrics = await fetchMetrics();
      setMetrics(freshMetrics);
      addLog("Database reset. Status counts cleared to 0.", "success");
    } catch (err) {
      addLog(`Reset failed: ${err.message}`, "error");
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const getTasksByColumn = (colName) => {
    const filtered = tasks.filter(t => {
      if (colName === 'pending') return t.status === 'pending';
      if (colName === 'processing') return t.status === 'processing' || t.status === 'retrying';
      if (colName === 'completed') return t.status === 'completed';
      if (colName === 'failed') return t.status === 'failed';
      return false;
    });

    const priorityWeight = { high: 3, default: 2, low: 1 };

    if (colName === 'pending') {
      return [...filtered].sort((a, b) => {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;
        return new Date(a.created_at) - new Date(b.created_at);
      });
    }

    if (colName === 'processing') {
      return [...filtered].sort((a, b) => {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;
        return new Date(a.started_at || 0) - new Date(b.started_at || 0);
      });
    }

    if (colName === 'completed') {
      return [...filtered].sort((a, b) => {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;
        return new Date(b.completed_at || 0) - new Date(a.completed_at || 0);
      });
    }

    if (colName === 'failed') {
      return [...filtered].sort((a, b) => {
        const weightA = priorityWeight[a.priority] || 0;
        const weightB = priorityWeight[b.priority] || 0;
        if (weightA !== weightB) return weightB - weightA;
        return new Date(b.completed_at || 0) - new Date(a.completed_at || 0);
      });
    }

    return filtered;
  };

  const getQueueCount = (priority) => {
    return tasks.filter(t => t.priority === priority && t.status === 'pending').length;
  };

  const getAverageExecutionTime = () => {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.started_at && t.completed_at);
    if (completedTasks.length === 0) return '0.0s';
    const total = completedTasks.reduce((sum, t) => {
      const start = new Date(t.started_at);
      const end = new Date(t.completed_at);
      const elapsed = (end - start) / 1000;
      return sum + (isNaN(elapsed) ? 0 : elapsed);
    }, 0);
    return `${(total / completedTasks.length).toFixed(1)}s`;
  };

  const getPriorityBadgeClass = (priority) => {
    if (priority === 'high') return 'badge-high';
    if (priority === 'low') return 'badge-low';
    return 'badge-default';
  };

  const getTypeBadgeClass = (type) => {
    if (type === 'image_processing') return 'tag-image';
    if (type === 'email_send') return 'tag-email';
    return 'tag-data';
  };

  const getRelativeTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const diffSec = Math.floor((new Date() - date) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString();
  };

  const renderTaskCard = (task) => {
    const isProcessing = task.status === 'processing' || task.status === 'retrying';
    const isCompleted = task.status === 'completed';
    const isFailed = task.status === 'failed';
    
    let durationText = '';
    if (isCompleted && task.started_at && task.completed_at) {
      const elapsed = (new Date(task.completed_at) - new Date(task.started_at)) / 1000;
      durationText = `${elapsed.toFixed(1)}s`;
    } else if (isProcessing && task.started_at) {
      const elapsed = (currentTime - new Date(task.started_at)) / 1000;
      durationText = `${Math.max(0, elapsed).toFixed(1)}s`;
    }

    const workerName = task.worker_id ? task.worker_id.split(':')[0] : 'unallocated';

    // Priority badge classes
    let priorityBadgeClass = 'hearthy-badge-gray';
    if (task.priority === 'high') priorityBadgeClass = 'hearthy-badge-red';
    else if (task.priority === 'default') priorityBadgeClass = 'hearthy-badge-blue';

    // Left border indicator class based on status
    let statusBorderClass = 'task-border-pending';
    if (task.status === 'processing') statusBorderClass = 'task-border-processing';
    else if (task.status === 'retrying') statusBorderClass = 'task-border-retrying';
    else if (task.status === 'completed') statusBorderClass = 'task-border-completed';
    else if (task.status === 'failed') statusBorderClass = 'task-border-failed';

    // Parse payload details
    let payloadText = '';
    try {
      const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
      if (payload) {
        if (task.type === 'image_processing') {
          payloadText = `Image: ${payload.width}x${payload.height} · ${payload.compression || 'lossless'}`;
        } else if (task.type === 'email_send') {
          payloadText = `To: ${payload.recipient || 'recipient'}`;
        } else {
          payloadText = `Data: ${payload.records || 0} recs · ${payload.operation || 'transform'}`;
        }
      }
    } catch (e) {
      // payload parse fail
    }

    return (
      <div className={`professional-task-card ${statusBorderClass} task-wrapper`} key={task.id} style={{
        opacity: (isCompleted || isFailed) ? 0.9 : 1,
      }}>
        {/* Header: Type and Priority badge */}
        <div className="task-header-row">
          <span className="task-title-text">
            {task.type.replace('_', ' ').toUpperCase()}
          </span>
          <span className={`hearthy-card-badge ${priorityBadgeClass}`} style={{ fontSize: '8.5px', padding: '2px 6px' }}>
            STATUS: {task.priority.toUpperCase()}
          </span>
        </div>

        {/* Meta: ID and Duration timer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px' }}>
          <span className="task-id-tag">ID: {task.id.substring(0, 8)}</span>
          {durationText && (
            <span className="elapsed-timer" style={{ color: isCompleted ? 'var(--status-completed)' : 'var(--status-processing)' }}>
              {durationText}
            </span>
          )}
        </div>

        {/* Payload Context / Error Box */}
        {isFailed ? (
          <div className="task-payload-box" style={{ 
            color: 'var(--status-failed)', 
            borderColor: 'rgba(239, 68, 68, 0.15)',
            backgroundColor: 'rgba(239, 68, 68, 0.02)'
          }}>
            {task.error || 'Execution timeout'}
          </div>
        ) : (
          payloadText && <div className="task-payload-box">{payloadText}</div>
        )}

        {/* Footer: Date timestamp and node executor */}
        <div className="task-footer-row">
          <span>
            {isCompleted ? `Finished ${getRelativeTime(task.completed_at)}` :
             isFailed ? `Failed ${getRelativeTime(task.completed_at)}` :
             isProcessing ? `Active ${getRelativeTime(task.started_at)}` :
             `Submitted ${getRelativeTime(task.created_at)}`}
          </span>
          {task.worker_id && (
            <span className="task-node-badge">
              {workerName}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app-root">
      {/* Header */}
      <header className="header" style={{ height: 'var(--header-height)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={20} color="var(--accent)" className="live-pulse" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                ORCHESTRIX
              </h1>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '9px', letterSpacing: '0.08em' }}>
                DISTRIBUTED TASK TELEMETRY
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="nav-tabs">
            <button 
              className={`nav-tab ${activeTab === 'dashboard' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`nav-tab ${activeTab === 'architecture' ? 'nav-tab-active' : ''}`}
              onClick={() => setActiveTab('architecture')}
            >
              Architecture
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#10b981', letterSpacing: '0.05em' }}>
            <span className="live-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
            SYSTEM NODE: HEALTHY
          </div>
        </div>
      </header>

      {/* Main Layout Stacking */}
      {activeTab === 'dashboard' ? (
        <div className="dashboard-layout">
        
        {/* Top Area: 8 Metrics Cards */}
        <div className="metrics-row">
          {/* Card 1: Backlog */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">Backlog</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {getQueueCount('high') + getQueueCount('default') + getQueueCount('low')}
              </div>
              <div className="hearthy-card-status-col">
                <span className={`hearthy-card-badge ${(getQueueCount('high') + getQueueCount('default') + getQueueCount('low')) > 10 ? 'hearthy-badge-red' : 'hearthy-badge-gray'}`}>
                  {(getQueueCount('high') + getQueueCount('default') + getQueueCount('low')) > 10 ? 'Busy' : 'Stable'}
                </span>
                <span className="hearthy-card-subtext">vs last min</span>
              </div>
            </div>
          </div>

          {/* Card 2: Workers */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">Workers</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {metrics.active_workers}
              </div>
              <div className="hearthy-card-status-col">
                <span className={`hearthy-card-badge ${metrics.active_workers > 0 ? 'hearthy-badge-green' : 'hearthy-badge-gray'}`}>
                  {metrics.active_workers > 0 ? 'Active' : 'Offline'}
                </span>
                <span className="hearthy-card-subtext">nodes online</span>
              </div>
            </div>
          </div>

          {/* Card 3: Throughput */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">Throughput</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {metrics.tasks_per_minute}
              </div>
              <div className="hearthy-card-status-col">
                <span className="hearthy-card-badge hearthy-badge-blue">
                  Avg: {getAverageExecutionTime()}
                </span>
                <span className="hearthy-card-subtext">tasks / min</span>
              </div>
            </div>
          </div>

          {/* Card 4: Success */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">Success</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {tasks.filter(t => t.status === 'completed').length}
              </div>
              <div className="hearthy-card-status-col">
                <span className="hearthy-card-badge hearthy-badge-green">
                  Healthy
                </span>
                <span className="hearthy-card-subtext">completed</span>
              </div>
            </div>
          </div>

          {/* Card 5: High Lane */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">High Lane</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {getQueueCount('high')}
              </div>
              <div className="hearthy-card-status-col">
                <span className={`hearthy-card-badge ${getQueueCount('high') > 0 ? 'hearthy-badge-red' : 'hearthy-badge-gray'}`}>
                  {getQueueCount('high') > 0 ? 'Active' : 'Empty'}
                </span>
                <span className="hearthy-card-subtext">priority lane</span>
              </div>
            </div>
          </div>

          {/* Card 6: Default Lane */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">Default Lane</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {getQueueCount('default')}
              </div>
              <div className="hearthy-card-status-col">
                <span className={`hearthy-card-badge ${getQueueCount('default') > 0 ? 'hearthy-badge-blue' : 'hearthy-badge-gray'}`}>
                  {getQueueCount('default') > 0 ? 'Pending' : 'Empty'}
                </span>
                <span className="hearthy-card-subtext">standard lane</span>
              </div>
            </div>
          </div>

          {/* Card 7: Low Lane */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">Low Lane</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {getQueueCount('low')}
              </div>
              <div className="hearthy-card-status-col">
                <span className="hearthy-card-badge hearthy-badge-gray">
                  Background
                </span>
                <span className="hearthy-card-subtext">low priority</span>
              </div>
            </div>
          </div>

          {/* Card 8: Failed */}
          <div className="stat-widget">
            <div className="hearthy-card-header">
              <span className="hearthy-card-title">Failed</span>
              <span className="hearthy-card-dots">•••</span>
            </div>
            <div className="hearthy-card-body">
              <div className="hearthy-card-value">
                {tasks.filter(t => t.status === 'failed').length}
              </div>
              <div className="hearthy-card-status-col">
                <span className={`hearthy-card-badge ${tasks.filter(t => t.status === 'failed').length > 0 ? 'hearthy-badge-red' : 'hearthy-badge-green'}`}>
                  {tasks.filter(t => t.status === 'failed').length > 0 ? 'Error Alert' : 'Stable'}
                </span>
                <span className="hearthy-card-subtext">failures</span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Area: Kanban Columns */}
        <div className="kanban-grid">
          {/* Column 1: Pending */}
          <div className="kanban-pane glow-top-pending">
            <div className="kanban-pane-header">
              <span className="pane-title" style={{ color: 'var(--status-pending)' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--status-pending)', display: 'inline-block' }}></span>
                Queued
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px', textTransform: 'none', fontWeight: 'normal' }}>
                  (H: {getQueueCount('high')} D: {getQueueCount('default')} L: {getQueueCount('low')})
                </span>
              </span>
              <span className="pane-count-badge">{getTasksByColumn('pending').length}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '270px' }}>
              {getTasksByColumn('pending').length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '24px 0', fontWeight: 500 }}>No tasks</div>
              ) : (
                getTasksByColumn('pending').map(renderTaskCard)
              )}
            </div>
          </div>

          {/* Column 2: Processing */}
          <div className="kanban-pane glow-top-processing">
            <div className="kanban-pane-header">
              <span className="pane-title" style={{ color: 'var(--status-processing)' }}>
                <span className="live-pulse" style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--status-processing)', display: 'inline-block' }}></span>
                Processing
              </span>
              <span className="pane-count-badge">{getTasksByColumn('processing').length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '270px' }}>
              {getTasksByColumn('processing').length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '24px 0', fontWeight: 500 }}>Idle</div>
              ) : (
                getTasksByColumn('processing').map(renderTaskCard)
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="kanban-pane glow-top-completed">
            <div className="kanban-pane-header">
              <span className="pane-title" style={{ color: 'var(--status-completed)' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--status-completed)', display: 'inline-block' }}></span>
                Success
              </span>
              <span className="pane-count-badge">{getTasksByColumn('completed').length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '270px' }}>
              {getTasksByColumn('completed').length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '24px 0', fontWeight: 500 }}>No tasks</div>
              ) : (
                getTasksByColumn('completed').map(renderTaskCard)
              )}
            </div>
          </div>

          {/* Column 4: Failed */}
          <div className="kanban-pane glow-top-failed">
            <div className="kanban-pane-header">
              <span className="pane-title" style={{ color: 'var(--status-failed)' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--status-failed)', display: 'inline-block' }}></span>
                Failed
              </span>
              <span className="pane-count-badge">{getTasksByColumn('failed').length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '270px' }}>
              {getTasksByColumn('failed').length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '24px 0', fontWeight: 500 }}>No failures</div>
              ) : (
                getTasksByColumn('failed').map(renderTaskCard)
              )}
            </div>
          </div>
        </div>

        {/* Bottom Area: Controls + Workers + Console */}
        <div className="bottom-row">
          
          {/* Telemetry Console Panel */}
          <div className="neon-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
              <Terminal size={14} color="var(--status-completed)" />
              TELEMETRY EVENTS CONSOLE
            </h3>
            <div className="telemetry-console" ref={consoleRef} style={{ flexGrow: 1, height: '150px' }}>
              {consoleLogs.length === 0 ? (
                <div className="console-text" style={{ color: 'var(--text-muted)' }}>Awaiting events from Orchestrix cluster...</div>
              ) : (
                consoleLogs.map((log, idx) => (
                  <div className="console-text" key={idx}>
                    <span className="console-ts">[{log.timestamp}]</span>
                    <span className={
                      log.type === 'success' ? 'text-success' : 
                      log.type === 'error' ? 'text-error' : 
                      log.type === 'warning' ? 'text-warning' : 'text-info'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Side Options Area: Workers + Controls side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 360px', gap: '16px', height: '100%' }}>
            
            {/* Workers State Panel */}
            <div className="neon-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                <Server size={14} color="var(--accent)" />
                CLUSTER NODES STATE ({metrics.active_workers})
              </h3>
              
              <div className="worker-flex" style={{ overflowY: 'auto', flexGrow: 1, maxHeight: '170px' }}>
                {metrics.workers.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '16px 0' }}>No active workers detected</div>
                ) : (
                  metrics.workers.map(worker => {
                    const tasksCount = worker.active_tasks || 0;
                    const capacity = worker.capacity || 4;
                    const percent = Math.min(100, (tasksCount / capacity) * 100);
                    const isOverloaded = tasksCount >= capacity;
                    const isStale = !worker.active;

                    let barColorClass = '';
                    if (percent >= 100) barColorClass = 'danger';
                    else if (percent >= 50) barColorClass = 'warning';

                    let statusText = 'ONLINE';
                    if (isStale) statusText = 'UNAVAILABLE';
                    else if (isOverloaded) statusText = 'OVERLOADED';

                    let cardClass = "worker-row";
                    if (isStale) cardClass += " worker-unavailable";
                    else if (isOverloaded) cardClass += " worker-overloaded";

                    return (
                      <div className={cardClass} key={worker.id} style={{ padding: '6px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span 
                              className={worker.active && !isOverloaded ? "live-pulse" : ""} 
                              style={{ 
                                width: '6px', 
                                height: '6px', 
                                borderRadius: '50%', 
                                backgroundColor: isStale ? 'var(--status-cancelled)' : 
                                                isOverloaded ? 'var(--status-failed)' : 'var(--status-completed)', 
                                display: 'inline-block' 
                              }}
                            ></span>
                            <span className="worker-label-id" style={{ fontSize: '11px' }}>{worker.id.split(':')[0]}</span>
                          </div>
                          <span className="worker-details-meta" style={{ fontSize: '10px', fontWeight: 'bold', color: isOverloaded ? 'var(--status-failed)' : undefined }}>
                            {statusText} ({worker.seconds_since_heartbeat}s)
                          </span>
                        </div>
                        
                        {!isStale && (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-secondary)' }}>
                              <span>Threads Active</span>
                              <span>{tasksCount} / {capacity}</span>
                            </div>
                            <div className="worker-bar-container">
                              <div className={`worker-bar-fill ${barColorClass}`} style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Controls Panel */}
            <div className="neon-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                <Settings size={14} color="var(--accent)" />
                CLUSTER ORCHESTRATION
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <button className="neon-btn neon-btn-secondary" style={{ flex: 1, padding: '4px', fontSize: '11px', height: '24px' }} onClick={() => handleBulkDispatch(10)}>+10</button>
                  <button className="neon-btn neon-btn-secondary" style={{ flex: 1, padding: '4px', fontSize: '11px', height: '24px' }} onClick={() => handleBulkDispatch(50)}>+50</button>
                  <button className="neon-btn neon-btn-secondary" style={{ flex: 1, padding: '4px', fontSize: '11px', height: '24px' }} onClick={() => handleBulkDispatch(100)}>+100</button>
                  <button className="neon-btn neon-btn-secondary" style={{ flex: 1, padding: '4px', fontSize: '11px', height: '24px' }} onClick={() => handleBulkDispatch(500)}>+500</button>
                </div>

                <div>
                  <button className="neon-btn" style={{ width: '100%', padding: '4px', fontSize: '11px', height: '24px', backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#ffffff', fontWeight: 800, boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }} onClick={handleClearDatabase}>
                    CLEAR DATABASE
                  </button>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                  <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                      <select className="neon-input" style={{ padding: '4px 8px', fontSize: '11px', height: '26px' }} value={taskType} onChange={e => setTaskType(e.target.value)}>
                        <option value="data_transform">data_transform</option>
                        <option value="image_processing">image_processing</option>
                        <option value="email_send">email_send</option>
                      </select>
                      <select className="neon-input" style={{ padding: '4px 8px', fontSize: '11px', height: '26px' }} value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                        <option value="high">HIGH</option>
                        <option value="default">DEFAULT</option>
                        <option value="low">LOW</option>
                      </select>
                    </div>

                    {submitError && (
                      <div style={{ color: 'var(--status-failed)', fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>
                        ERROR: {submitError}
                      </div>
                    )}

                    <button className="neon-btn neon-btn-primary" type="submit" style={{ width: '100%', padding: '4px 12px', fontSize: '11px', height: '26px' }} disabled={isSubmitting}>
                      <Play size={10} />
                      {isSubmitting ? 'DISPATCHING...' : 'DISPATCH TASK'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

          </div>

        </div>

        </div>
      ) : (
        <ArchitectureExploration />
      )}
    </div>
  );
}

export default App;
