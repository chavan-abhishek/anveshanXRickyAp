import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, MapPin, Clock, Check, X, Activity } from 'lucide-react';
import { sosService } from '../../services/api';
import LiveTrackingMap from '../Maps/LiveTrackingMap';

const SosDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchAlerts();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      console.log('Fetching SOS alerts...'); // Debug log
      
      const [allResponse, activeResponse] = await Promise.all([
        sosService.getAllAlerts().catch(err => {
          console.error('Error fetching all alerts:', err);
          return { data: [] };
        }),
        sosService.getActiveAlerts().catch(err => {
          console.error('Error fetching active alerts:', err);
          return { data: [] };
        })
      ]);
      
      console.log('All alerts response:', allResponse.data); // Debug log
      console.log('Active alerts response:', activeResponse.data); // Debug log
      
      setAlerts(allResponse.data || []);
      setActiveAlerts(activeResponse.data || []);
    } catch (error) {
      console.error('Error in fetchAlerts:', error);
      // Don't show alert popup, just log the error
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    try {
      const wsUrl = 'ws://localhost:8080/ws-ricky';
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('SOS WebSocket connected');
        setWsConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data);
          console.log('New SOS alert received:', alert);
          
          setActiveAlerts(prev => [alert, ...prev]);
          setAlerts(prev => [alert, ...prev]);
          
          // Play alert sound
          playAlertSound();
          
          // Show browser notification
          showNotification(alert);
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('SOS WebSocket disconnected');
        setWsConnected(false);
        
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setWsConnected(false);
    }
  };

  const playAlertSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
      
      // Second beep
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        
        oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime);
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        
        oscillator2.start();
        oscillator2.stop(audioContext.currentTime + 0.2);
      }, 300);
    } catch (error) {
      console.error('Error playing alert sound:', error);
    }
  };

  const showNotification = (alert) => {
    if (Notification.permission === 'granted') {
      new Notification('🚨 Emergency Alert', {
        body: `SOS Alert from ${alert.driverId || alert.driver_id || 'Unknown Driver'}`,
        icon: '/favicon.ico'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showNotification(alert);
        }
      });
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await sosService.acknowledgeAlert(alertId);
      
      setActiveAlerts(prev => prev.filter(alert => alert.id !== alertId));
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true, status: 'RESOLVED' }
          : alert
      ));
      
      console.log('Alert acknowledged successfully'); // Changed from alert() to console.log
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      alert('Failed to acknowledge alert');
    }
  };

  const sendTestAlert = async () => {
    try {
      const testAlert = {
        type: 'SOS_BUTTON',
        latitude: 28.6139 + (Math.random() - 0.5) * 0.01,
        longitude: 77.2090 + (Math.random() - 0.5) * 0.01,
        driverId: `TEST-DRIVER-${Date.now()}`
      };
      
      const response = await sosService.sendSosAlert(testAlert);
      console.log('Test alert sent:', response.data);
      alert('Test SOS alert sent successfully');
      
      // Refresh alerts after sending test alert
      setTimeout(fetchAlerts, 1000);
    } catch (error) {
      console.error('Error sending test alert:', error);
      alert('Failed to send test alert');
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'Invalid date';
    return new Date(timestamp).toLocaleString();
  };

  const getAlertTypeEmoji = (type) => {
    switch (type?.toUpperCase()) {
      case 'CRASH': return '🚗💥';
      case 'SOS_BUTTON': return '🆘';
      case 'GEOFENCE': return '⚠️🗺️';
      case 'OVERSPEED': return '⚡🏃';
      default: return '🚨';
    }
  };

  const getAlertTypeColor = (type) => {
    switch (type?.toUpperCase()) {
      case 'CRASH': return 'border-red-500 bg-red-50';
      case 'SOS_BUTTON': return 'border-orange-500 bg-orange-50';
      case 'GEOFENCE': return 'border-yellow-500 bg-yellow-50';
      case 'OVERSPEED': return 'border-purple-500 bg-purple-50';
      default: return 'border-red-500 bg-red-50';
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading SOS alerts...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">SOS Emergency Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {wsConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={sendTestAlert}
            className="btn-outline text-sm"
          >
            Send Test Alert
          </button>
          <button
            onClick={fetchAlerts}
            className="btn-secondary"
          >
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 p-3 rounded text-xs">
          <p>Debug: Active Alerts: {activeAlerts.length}, Total Alerts: {alerts.length}</p>
          <p>WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}</p>
        </div>
      )}

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mr-2 animate-pulse" />
            <h3 className="text-lg font-semibold text-red-800">
              🚨 ACTIVE EMERGENCY ALERTS ({activeAlerts.length})
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className={`bg-white border-2 rounded-lg p-4 ${getAlertTypeColor(alert.type)}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{getAlertTypeEmoji(alert.type)}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-800">
                        {alert.driverId || alert.driver_id}
                      </span>
                      <div className="text-xs text-gray-600">
                        {alert.type?.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(alert.timestamp)}
                  </span>
                </div>
                
                <div className="text-sm text-gray-700 mb-4">
                  <div className="flex items-center mb-2">
                    <MapPin className="h-4 w-4 mr-1 text-blue-600" />
                    <span className="font-mono text-xs">
                      {alert.latitude?.toFixed(6)}, {alert.longitude?.toFixed(6)}
                    </span>
                  </div>
                  
                  {alert.message && (
                    <div className="text-xs bg-gray-100 p-2 rounded">
                      {alert.message}
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="flex-1 bg-red-600 text-white text-sm py-2 px-3 rounded hover:bg-red-700 flex items-center justify-center"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Acknowledge
                  </button>
                  <a
                    href={`https://maps.google.com/?q=${alert.latitude},${alert.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 text-white text-sm py-2 px-3 rounded hover:bg-blue-700"
                  >
                    📍 Map
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Map */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-blue-600" />
          Emergency Locations Map
        </h3>
        <div className="h-96 rounded-lg overflow-hidden">
          <LiveTrackingMap sosAlerts={activeAlerts} />
        </div>
      </div>

      {/* Recent Alerts History */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-gray-600" />
          Recent Alerts History
        </h3>
        
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No alerts recorded</p>
            <p className="text-sm">Send a test alert to see data here</p>
            <button
              onClick={sendTestAlert}
              className="mt-4 btn-primary"
            >
              Send Test Alert
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {alerts.slice(0, 20).map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.status === 'ACTIVE' 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-300 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <span className="text-lg mr-3">{getAlertTypeEmoji(alert.type)}</span>
                    <div>
                      <span className="text-sm font-medium">
                        {alert.driverId || alert.driver_id}
                      </span>
                      <div className="text-xs text-gray-600">
                        {alert.type?.replace('_', ' ')} Alert
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      alert.status === 'ACTIVE'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {alert.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    {alert.latitude?.toFixed(6)}, {alert.longitude?.toFixed(6)}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatDateTime(alert.timestamp)}
                  </div>
                  {alert.message && (
                    <div className="text-xs bg-gray-100 p-2 rounded mt-2">
                      {alert.message}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SosDashboard;