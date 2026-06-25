// API Client module for Orchestrix Dashboard

const API_BASE = import.meta.env.VITE_API_URL || '';

export const fetchMetrics = async () => {
  const response = await fetch(`${API_BASE}/metrics/`);
  if (!response.ok) {
    throw new Error('Failed to fetch system metrics');
  }
  return response.json();
};

export const fetchTasks = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.type) query.append('type', params.type);
  if (params.limit) query.append('limit', params.limit);
  if (params.offset) query.append('offset', params.offset);

  const queryString = query.toString();
  const url = `${API_BASE}/tasks/${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch tasks list');
  }
  return response.json();
};

export const submitTask = async (taskData) => {
  const response = await fetch(`${API_BASE}/tasks/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || 'Failed to submit task');
  }
  return response.json();
};

export const getSSEUrl = () => {
  return `${API_BASE}/metrics/stream/tasks`;
};

export const resetCluster = async () => {
  const response = await fetch(`${API_BASE}/tasks/reset`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to reset cluster states');
  }
  return response.json();
};
