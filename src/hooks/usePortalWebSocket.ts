import { useState, useEffect, useCallback } from 'react';
import { OfficialPortal, PortalConnectionState, PortalLiveEvent } from '../types';
import { portalWebSocketService } from '../services/portalWebSocket';

export function usePortalWebSocket() {
  const [connectionState, setConnectionState] = useState<PortalConnectionState>(
    portalWebSocketService.getState()
  );
  const [liveEvents, setLiveEvents] = useState<PortalLiveEvent[]>([]);
  const [isSoundOn, setIsSoundOn] = useState<boolean>(portalWebSocketService.isSoundEnabled());

  useEffect(() => {
    portalWebSocketService.connect();

    const unsubStatus = portalWebSocketService.subscribeStatus((newState) => {
      setConnectionState(newState);
    });

    const unsubEvent = portalWebSocketService.subscribe((event) => {
      setLiveEvents((prev) => [event, ...prev.slice(0, 49)]);
    });

    return () => {
      unsubStatus();
      unsubEvent();
    };
  }, []);

  const triggerScan = useCallback((portal?: OfficialPortal) => {
    portalWebSocketService.triggerScan(portal);
  }, []);

  const toggleSound = useCallback(() => {
    const nextVal = !isSoundOn;
    portalWebSocketService.setSoundEnabled(nextVal);
    setIsSoundOn(nextVal);
    if (nextVal) {
      portalWebSocketService.playChime();
    }
  }, [isSoundOn]);

  const pingServer = useCallback(() => {
    portalWebSocketService.sendPing();
  }, []);

  return {
    connectionState,
    liveEvents,
    triggerScan,
    toggleSound,
    isSoundOn,
    pingServer,
  };
}
