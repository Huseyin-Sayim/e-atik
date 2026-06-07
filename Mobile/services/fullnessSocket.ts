import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import DatabaseService from '../database/DatabaseService';

export type FullnessPayload = {
  binId: string;
  regionId?: string | null;
  predictedFullness?: number;
  fullnessPercent?: number;
  isCritical?: boolean;
  label?: string;
};

export type FullnessSnapshotPayload = {
  regionId?: string;
  bins: FullnessPayload[];
};

type FullnessListener = (payload: FullnessPayload) => void;
type SnapshotListener = (payload: FullnessSnapshotPayload) => void;

class FullnessSocketService {
  private socket: Socket | null = null;
  private connectPromise: Promise<void> | null = null;
  private fullnessListeners = new Set<FullnessListener>();
  private snapshotListeners = new Set<SnapshotListener>();

  subscribe(listener: FullnessListener): () => void {
    this.fullnessListeners.add(listener);
    this.connect().catch(() => {});
    return () => {
      this.fullnessListeners.delete(listener);
    };
  }

  subscribeSnapshot(listener: SnapshotListener): () => void {
    this.snapshotListeners.add(listener);
    this.connect().catch(() => {});
    return () => {
      this.snapshotListeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.createConnection();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private async createConnection(): Promise<void> {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) {
      return;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const socket = io(DatabaseService.getSocketUrl(), {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
    });

    this.socket = socket;

    socket.on('connect', () => {
      console.log('[FullnessSocket] bağlandı');
    });

    socket.on('connect_error', (err) => {
      console.warn('[FullnessSocket] bağlantı hatası:', err.message);
    });

    socket.on('bin:fullness:increased', (payload: FullnessPayload) => {
      this.emitFullness(payload);
    });

    socket.on('bin:fullness:updated', (payload: FullnessPayload) => {
      this.emitFullness(payload);
    });

    socket.on('bin:fullness:snapshot', (payload: FullnessSnapshotPayload) => {
      this.snapshotListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.warn('[FullnessSocket] snapshot listener error', err);
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
      };

      if (socket.connected) {
        resolve();
        return;
      }

      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
    });
  }

  private emitFullness(payload: FullnessPayload): void {
    this.fullnessListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[FullnessSocket] listener error', err);
      }
    });
  }
}

const fullnessSocketService = new FullnessSocketService();
export default fullnessSocketService;
