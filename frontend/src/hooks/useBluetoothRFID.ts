import { useState, useEffect, useCallback } from 'react';
import { useRFIDOfflineQueue } from './useRFIDOfflineQueue';

export type ScannedAnimal = {
  rfid: string;
  timestamp: Date;
  rssi?: number;
  animal?: any; // To store resolved animal from API
};

type BluetoothState = 'idle' | 'scanning' | 'connected' | 'reading' | 'error';

const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

export function useBluetoothRFID() {
  const [status, setStatus] = useState<BluetoothState>('idle');
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [lastScan, setLastScan] = useState<ScannedAnimal | null>(null);
  const [scanHistory, setScanHistory] = useState<ScannedAnimal[]>([]);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  
  const { add: addToQueue } = useRFIDOfflineQueue();

  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'bluetooth' in navigator);
  }, []);

  const handleNotification = useCallback(async (event: any) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(value);
    
    // Extract 15 digits
    const matches = text.replace(/[^0-9]/g, '').match(/\d{15}/);
    if (matches && matches[0]) {
      const rfid = matches[0];
      const timestamp = new Date();
      const newScan: ScannedAnimal = { rfid, timestamp };
      
      // Auto-save to offline queue
      addToQueue({
        rfid_code: rfid,
        timestamp: timestamp.toISOString(),
        synced: false
      });

      // Try online resolve
      if (navigator.onLine) {
        try {
          const res = await fetch(`/api/animals/rfid-scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rfid_code: rfid, timestamp: timestamp.toISOString() })
          });
          const data = await res.json();
          if (data.found) {
            newScan.animal = data.animal;
          }
        } catch (e) {
          console.error("Failed to sync directly", e);
        }
      }

      setLastScan(newScan);
      setScanHistory(prev => [newScan, ...prev]);
    }
  }, [addToQueue]);

  const connect = async () => {
    if (!isSupported) return;
    setStatus('scanning');
    setErrorMsg(null);
    try {
      const selectedDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'RFID' },
          { namePrefix: 'Allflex' },
          { namePrefix: 'Gallagher' },
          { namePrefix: 'Herd' },
          { services: [SERVICE_UUID] }
        ],
        optionalServices: [SERVICE_UUID]
      });

      setDevice(selectedDevice);
      setStatus('connected');

      selectedDevice.addEventListener('gattserverdisconnected', () => {
        setStatus('idle');
        setDevice(null);
        setCharacteristic(null);
      });

      const server = await selectedDevice.gatt?.connect();
      if (!server) throw new Error('No GATT server');

      const service = await server.getPrimaryService(SERVICE_UUID);
      const char = await service.getCharacteristic(TX_CHARACTERISTIC_UUID);
      setCharacteristic(char);
      
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', handleNotification);
      setStatus('reading');

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  const disconnect = () => {
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    setStatus('idle');
    setDevice(null);
    setCharacteristic(null);
  };

  const startReading = async () => {
    if (characteristic) {
      await characteristic.startNotifications();
      setStatus('reading');
    }
  };

  const stopReading = async () => {
    if (characteristic) {
      await characteristic.stopNotifications();
      setStatus('connected');
    }
  };

  return {
    status,
    device,
    lastScan,
    scanHistory,
    isSupported,
    errorMsg,
    connect,
    disconnect,
    startReading,
    stopReading
  };
}
