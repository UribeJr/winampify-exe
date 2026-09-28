import { useReducer, useCallback, useMemo } from 'react';
import { APP_REGISTRY } from './appRegistry';

const BASE_Z = 100;
const WINDOW_MARGIN = 10;

const initialState = { windows: [], activeId: null, nextZ: BASE_Z };

const centeredFrame = (defaultSize, viewport, taskbarHeight) => {
  const availableHeight = viewport.height - taskbarHeight;
  const width = Math.min(defaultSize.width, viewport.width - WINDOW_MARGIN * 2);
  const height = Math.min(defaultSize.height, availableHeight - WINDOW_MARGIN * 2);
  return {
    size: { width, height },
    position: {
      x: Math.max(WINDOW_MARGIN, Math.round((viewport.width - width) / 2)),
      y: Math.max(WINDOW_MARGIN, Math.round((availableHeight - height) / 2))
    }
  };
};

function reducer(state, action) {
  switch (action.type) {
    case 'open': {
      const { appId, request, viewport, taskbarHeight } = action;
      const app = APP_REGISTRY[appId];
      if (!app) return state;
      const stamped = request ? { ...request, nonce: Date.now() } : null;

      const existing = app.singleton && state.windows.find((w) => w.appId === appId);
      if (existing) {
        return {
          ...state,
          activeId: existing.id,
          nextZ: state.nextZ + 1,
          windows: state.windows.map((w) =>
            w.id === existing.id
              ? { ...w, isMinimized: false, zIndex: state.nextZ, request: stamped || w.request }
              : w
          )
        };
      }

      const id = `${appId}-${Date.now()}`;
      const frame = centeredFrame(app.defaultSize, viewport, taskbarHeight);
      return {
        ...state,
        activeId: id,
        nextZ: state.nextZ + 1,
        windows: [
          ...state.windows,
          {
            id,
            appId,
            title: app.title,
            icon: app.icon,
            isMinimized: false,
            isMaximized: false,
            zIndex: state.nextZ,
            request: stamped,
            ...frame
          }
        ]
      };
    }
    case 'focus': {
      const win = state.windows.find((w) => w.id === action.id);
      if (!win || (state.activeId === action.id && !win.isMinimized)) return state;
      return {
        ...state,
        activeId: action.id,
        nextZ: state.nextZ + 1,
        windows: state.windows.map((w) =>
          w.id === action.id ? { ...w, isMinimized: false, zIndex: state.nextZ } : w
        )
      };
    }
    case 'minimize': {
      const remaining = state.windows.filter((w) => w.id !== action.id && !w.isMinimized);
      const nextActive = remaining.sort((a, b) => b.zIndex - a.zIndex)[0];
      return {
        ...state,
        activeId: nextActive ? nextActive.id : null,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, isMinimized: true } : w))
      };
    }
    case 'toggleMaximize':
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, isMaximized: !w.isMaximized } : w))
      };
    case 'move':
      return {
        ...state,
        windows: state.windows.map((w) => (w.id === action.id ? { ...w, position: action.position } : w))
      };
    case 'close':
      return {
        ...state,
        activeId: state.activeId === action.id ? null : state.activeId,
        windows: state.windows.filter((w) => w.id !== action.id)
      };
    case 'closeAll':
      return initialState;
    default:
      return state;
  }
}

/**
 * Window state for the desktop: open/focus/minimize/maximize/move/close with z-ordering.
 * Apps come from APP_REGISTRY; singleton apps re-focus (and receive the new request) instead of duplicating.
 */
export default function useWindowManager() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const open = useCallback((appId, { request, viewport, taskbarHeight = 30 } = {}) => {
    dispatch({
      type: 'open',
      appId,
      request,
      viewport: viewport || { width: window.innerWidth, height: window.innerHeight },
      taskbarHeight
    });
  }, []);

  const actions = useMemo(() => ({
    open,
    focus: (id) => dispatch({ type: 'focus', id }),
    minimize: (id) => dispatch({ type: 'minimize', id }),
    toggleMaximize: (id) => dispatch({ type: 'toggleMaximize', id }),
    move: (id, position) => dispatch({ type: 'move', id, position }),
    close: (id) => dispatch({ type: 'close', id }),
    closeAll: () => dispatch({ type: 'closeAll' })
  }), [open]);

  // Taskbar button: restore a minimized window, minimize the active one, otherwise focus
  const toggleFromTaskbar = useCallback((id) => {
    const win = state.windows.find((w) => w.id === id);
    if (!win) return;
    if (win.isMinimized) dispatch({ type: 'focus', id });
    else if (state.activeId === id) dispatch({ type: 'minimize', id });
    else dispatch({ type: 'focus', id });
  }, [state.windows, state.activeId]);

  return {
    windows: state.windows,
    activeId: state.activeId,
    ...actions,
    toggleFromTaskbar
  };
}
