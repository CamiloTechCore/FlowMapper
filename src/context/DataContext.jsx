import { useReducer, useCallback } from 'react';
import api from '../services/api';
const EMPTY = Object.freeze([]);

// ── Estado inicial ───────────────────────────────────────────────
const INIT = {
  teams:     [],
  processes: [],
  flows:     [],
  nodes:     {},  // { [flowId]: Node[] }
  edges:     {},  // { [flowId]: Edge[] }
  stats:     null,
  loading:   {},  // { [key]: bool }
  error:     null,
};

// ── Reducer ──────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_TEAMS':
      return { ...state, teams: action.data };
    case 'SET_PROCESSES':
      return { ...state, processes: action.data };
    case 'SET_FLOWS':
      return { ...state, flows: action.data };
    case 'ADD_TEAM':
      return { ...state, teams: [...state.teams, action.data] };
    case 'UPD_TEAM':
      return { ...state, teams: state.teams.map(t => t.id === action.data.id ? action.data : t) };
    case 'DEL_TEAM':
      return { ...state, teams: state.teams.filter(t => t.id !== action.id) };
    case 'ADD_PROCESS':
      return { ...state, processes: [...state.processes, action.data] };
    case 'UPD_PROCESS':
      return { ...state, processes: state.processes.map(p => p.id === action.data.id ? action.data : p) };
    case 'DEL_PROCESS':
      return { ...state, processes: state.processes.filter(p => p.id !== action.id) };
    case 'ADD_FLOW':
      return { ...state, flows: [...state.flows, action.data],
               nodes: { ...state.nodes, [action.data.id]: [] },
               edges: { ...state.edges, [action.data.id]: [] } };
    case 'UPD_FLOW':
      return { ...state, flows: state.flows.map(f => f.id === action.data.id ? action.data : f) };
    case 'DEL_FLOW': {
      const nodes = { ...state.nodes }, edges = { ...state.edges };
      delete nodes[action.id]; delete edges[action.id];
      return { ...state, flows: state.flows.filter(f => f.id !== action.id), nodes, edges };
    }
    case 'SET_FLOW_GRAPH':
      return { ...state,
               nodes: { ...state.nodes, [action.flowId]: action.nodes },
               edges: { ...state.edges, [action.flowId]: action.edges } };
    case 'ADD_NODE': {
      const cur = state.nodes[action.flowId] || [];
      return { ...state, nodes: { ...state.nodes, [action.flowId]: [...cur, action.data] } };
    }
    case 'DEL_NODE': {
      const cur = state.nodes[action.flowId] || [];
      return { ...state, nodes: { ...state.nodes, [action.flowId]: cur.filter(n => n.id !== action.id) } };
    }
    case 'ADD_EDGE': {
      const cur = state.edges[action.flowId] || [];
      return { ...state, edges: { ...state.edges, [action.flowId]: [...cur, action.data] } };
    }
    case 'DEL_EDGE': {
      const cur = state.edges[action.flowId] || [];
      return { ...state, edges: { ...state.edges, [action.flowId]: cur.filter(e => e.id !== action.id) } };
    }
    case 'SET_STATS':
      return { ...state, stats: action.data };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────
import { DataContext } from './dataStore';

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT);

  const load = useCallback(async (key, fn, successAction) => {
    dispatch({ type: 'SET_LOADING', key, value: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      const data = await fn();
      dispatch({ ...successAction, data });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message });
      console.error('[DataContext]', err);
    } finally {
      dispatch({ type: 'SET_LOADING', key, value: false });
    }
  }, []);

  // ── Equipos ───────────────────────────────────────────────────
  const fetchTeams = useCallback(() =>
    load('teams', api.getTeams, { type: 'SET_TEAMS' }), [load]);

  const createTeam = useCallback(async (d) => {
    const data = await api.createTeam(d);
    dispatch({ type: 'ADD_TEAM', data });
    return data;
  }, []);

  const updateTeam = useCallback(async (d) => {
    const data = await api.updateTeam(d);
    dispatch({ type: 'UPD_TEAM', data });
    return data;
  }, []);

  const deleteTeam = useCallback(async (id) => {
    await api.deleteTeam(id);
    dispatch({ type: 'DEL_TEAM', id });
  }, []);

  // ── Procesos ──────────────────────────────────────────────────
  const fetchProcesses = useCallback((teamId) =>
    load('processes', () => api.getProcesses(teamId), { type: 'SET_PROCESSES' }), [load]);

  const fetchAllProcesses = useCallback(() =>
    load('processes', api.getAllProcesses, { type: 'SET_PROCESSES' }), [load]);

  const createProcess = useCallback(async (d) => {
    const data = await api.createProcess(d);
    dispatch({ type: 'ADD_PROCESS', data });
    return data;
  }, []);

  const updateProcess = useCallback(async (d) => {
    const data = await api.updateProcess(d);
    dispatch({ type: 'UPD_PROCESS', data });
    return data;
  }, []);

  const deleteProcess = useCallback(async (id) => {
    await api.deleteProcess(id);
    dispatch({ type: 'DEL_PROCESS', id });
  }, []);

  // ── Flujos ────────────────────────────────────────────────────
  const fetchFlows = useCallback((processId) =>
    load('flows', () => api.getFlows(processId), { type: 'SET_FLOWS' }), [load]);

  const fetchAllFlows = useCallback(() =>
    load('flows', api.getAllFlows, { type: 'SET_FLOWS' }), [load]);

  const createFlow = useCallback(async (d) => {
    const data = await api.createFlow(d);
    dispatch({ type: 'ADD_FLOW', data });
    return data;
  }, []);

  const updateFlow = useCallback(async (d) => {
    const data = await api.updateFlow(d);
    dispatch({ type: 'UPD_FLOW', data });
    return data;
  }, []);

  const deleteFlow = useCallback(async (id) => {
    await api.deleteFlow(id);
    dispatch({ type: 'DEL_FLOW', id });
  }, []);

  // ── Grafo completo ────────────────────────────────────────────
  const fetchFullFlow = useCallback(async (flowId) => {
    dispatch({ type: 'SET_LOADING', key: 'graph_' + flowId, value: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      const { flow, nodes, edges } = await api.getFullFlow(flowId);
      dispatch({ type: 'UPD_FLOW', data: flow });
      dispatch({ type: 'SET_FLOW_GRAPH', flowId, nodes, edges });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: err.message });
    } finally {
      dispatch({ type: 'SET_LOADING', key: 'graph_' + flowId, value: false });
    }
  }, []);

  // ── Batch save (flujo + nodos + edges de una vez) ─────────────
  const saveFullFlow = useCallback(async ({ flow, nodes, edges }) => {
    const { flow: savedFlow, nodes: savedNodes, edges: savedEdges } = await api.saveFullFlow({ flow, nodes, edges });
    dispatch({ type: flow.id ? 'UPD_FLOW' : 'ADD_FLOW', data: savedFlow });
    dispatch({ type: 'SET_FLOW_GRAPH', flowId: savedFlow.id, nodes: savedNodes, edges: savedEdges });
    return { flow: savedFlow, nodes: savedNodes, edges: savedEdges };
  }, []);

  // ── Stats ─────────────────────────────────────────────────────
  const fetchStats = useCallback(() =>
    load('stats', api.getStats, { type: 'SET_STATS' }), [load]);

  // ── Context value ─────────────────────────────────────────────
  const value = {
    ...state,
    // Teams
    fetchTeams, createTeam, updateTeam, deleteTeam,
    // Processes
    fetchProcesses, fetchAllProcesses, createProcess, updateProcess, deleteProcess,
    // Flows
    fetchFlows, fetchAllFlows, createFlow, updateFlow, deleteFlow,
    // Graph
    fetchFullFlow, saveFullFlow,
    // Stats
    fetchStats,
    // Helpers
    isLoading: (key) => !!state.loading[key],
    teamById: (id) => state.teams.find(t => t.id === id),
    processByid: (id) => state.processes.find(p => p.id === id),
    flowById: (id) => state.flows.find(f => f.id === id),
    processesByTeam: (teamId) => state.processes.filter(p => p.teamId === teamId),
    flowsByTeam: (teamId) => state.flows.filter(f => f.teamId === teamId),
    flowsByProcess: (pid) => state.flows.filter(f => f.processId === pid),
    nodesForFlow: (flowId) => state.nodes[flowId] || EMPTY,
    edgesForFlow: (flowId) => state.edges[flowId] || EMPTY,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
