// web/src/lib/socket-io-client-stub.js
// Заглушка для socket.io-client

class Socket {
  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.connected = false;
    this.disconnected = true;
    this.id = null;
  }

  connect() {
    this.connected = true;
    this.disconnected = false;
    return this;
  }

  disconnect() {
    this.connected = false;
    this.disconnected = true;
    return this;
  }

  on(event, callback) {
    // No-op для веба
    return this;
  }

  off(event, callback) {
    // No-op для веба
    return this;
  }

  emit(event, ...args) {
    // No-op для веба
    return this;
  }

  once(event, callback) {
    // No-op для веба
    return this;
  }

  removeListener(event, callback) {
    // No-op для веба
    return this;
  }

  removeAllListeners(event) {
    // No-op для веба
    return this;
  }
}

// Экспортируем io как именованный экспорт (для import { io } from 'socket.io-client')
export function io(url, options) {
  return new Socket(url, options);
}

// Экспортируем io как default (для import io from 'socket.io-client')
export default io;

// Экспортируем Socket тип/класс
export { Socket };

