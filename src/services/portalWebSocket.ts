import { apiFetch } from './api';
import { OfficialPortal, PortalConnectionState, PortalLiveEvent, PortalMonitorHealth } from '../types';

type EventListener = (event: PortalLiveEvent) => void;
type StatusListener = (state: PortalConnectionState) => void;

class PortalWebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private eventListeners: Set<EventListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private audioContext: AudioContext | null = null;
  private soundEnabled = true;

  // Active state
  private state: PortalConnectionState = {
    connected: false,
    status: 'disconnected',
    latencyMs: 0,
    lastPing: null,
    activePortals: [],
    connectedClientsCount: 0,
    totalEventsReceived: 0,
    lastEventTime: '',
  };

  // Recent received event IDs to prevent duplicate processing (Idempotency requirement)
  private processedEventIds = new Set<string>();

  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.updateState({ status: this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting' });

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws/portals`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateState({
          connected: true,
          status: 'connected',
          lastPing: new Date().toISOString(),
        });
        this.startPingInterval();
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleIncomingMessage(payload);
        } catch (err) {
          console.warn('Error parsing WebSocket message:', err);
        }
      };

      this.socket.onclose = () => {
        this.cleanupPingInterval();
        this.updateState({ connected: false, status: 'disconnected' });
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('Portal WebSocket encountered warning/disconnect:', err);
        this.updateState({ connected: false, status: 'error' });
      };
    } catch (err) {
      console.warn('Failed to initialize WebSocket client:', err);
      this.updateState({ connected: false, status: 'error' });
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(msg: any): void {
    if (msg.type === 'portal:init') {
      const data = msg.data || {};
      this.updateState({
        connected: true,
        status: 'connected',
        activePortals: data.activePortals || this.state.activePortals,
        connectedClientsCount: data.connectedClientsCount || 1,
      });

      // Dispatch initial recent events if any
      if (Array.isArray(data.recentEvents)) {
        data.recentEvents.slice(0, 5).forEach((evt: PortalLiveEvent) => {
          if (!this.processedEventIds.has(evt.id)) {
            this.processedEventIds.add(evt.id);
            this.notifyEventListeners(evt);
          }
        });
      }
    } else if (msg.type === 'portal:event') {
      const event: PortalLiveEvent = msg.event;
      if (event && !this.processedEventIds.has(event.id)) {
        this.processedEventIds.add(event.id);
        // Keep set size manageable
        if (this.processedEventIds.size > 200) {
          const firstKey = this.processedEventIds.values().next().value;
          if (firstKey) this.processedEventIds.delete(firstKey);
        }

        this.updateState({
          totalEventsReceived: this.state.totalEventsReceived + 1,
          lastEventTime: new Date().toISOString(),
        });

        // Play chime on tender published or corrigendum
        if (event.eventType === 'tender_published' || event.eventType === 'corrigendum_issued') {
          this.playChime();
        }

        this.notifyEventListeners(event);
      }
    } else if (msg.type === 'portal:status') {
      const data = msg.data || {};
      this.updateState({
        connectedClientsCount: data.connectedClientsCount || this.state.connectedClientsCount,
        activePortals: data.activePortals || this.state.activePortals,
      });
    } else if (msg.type === 'server:pong') {
      if (msg.clientTimestamp) {
        const roundtrip = Math.max(8, Date.now() - msg.clientTimestamp);
        this.updateState({
          latencyMs: roundtrip,
          lastPing: new Date().toISOString(),
        });
      }
    }
  }

  private startPingInterval(): void {
    this.cleanupPingInterval();
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 12000);
  }

  private cleanupPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public sendPing(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'client:ping',
          clientTimestamp: Date.now(),
        })
      );
    }
  }

  public triggerScan(portal?: OfficialPortal): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'client:trigger_scan',
          portal: portal || 'CPPP',
          timestamp: Date.now(),
        })
      );
    } else {
      // Fallback via REST API if WebSocket is reconnecting
      apiFetch('/api/cloud-functions/scraper-trigger', {
        method: 'POST',
        body: JSON.stringify({ sector: 'Civil Construction' }),
      }).catch((err) => console.warn('Fallback trigger error:', err));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnect attempts reached. Waiting for next user gesture.');
      return;
    }
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanupPingInterval();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.updateState({ connected: false, status: 'disconnected' });
  }

  public getState(): PortalConnectionState {
    return { ...this.state };
  }

  public subscribe(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getState());
    return () => this.statusListeners.delete(listener);
  }

  private updateState(partial: Partial<PortalConnectionState>): void {
    this.state = { ...this.state, ...partial };
    this.statusListeners.forEach((fn) => fn(this.getState()));
  }

  private notifyEventListeners(event: PortalLiveEvent): void {
    this.eventListeners.forEach((fn) => fn(event));
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public playChime(): void {
    if (!this.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.audioContext.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.12); // A5 note
      gain.gain.setValueAtTime(0.04, this.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      osc.start();
      osc.stop(this.audioContext.currentTime + 0.36);
    } catch {
      // Audio playback restrictions in silent mode
    }
  }
}

export const portalWebSocketService = new PortalWebSocketService();
