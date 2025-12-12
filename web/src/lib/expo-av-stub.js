// Заглушка для expo-av
import React from 'react';
import { View } from 'react-native';

export const Video = React.forwardRef((props, ref) => {
  return <View ref={ref} {...props} />;
});

export const Audio = {
  Sound: class {
    constructor() {}
    async loadAsync() { return {}; }
    async playAsync() { return {}; }
    async pauseAsync() { return {}; }
    async stopAsync() { return {}; }
    async unloadAsync() { return {}; }
    async setPositionAsync() { return {}; }
    async setVolumeAsync() { return {}; }
    async setRateAsync() { return {}; }
    async getStatusAsync() { return { isLoaded: false }; }
  },
  setAudioModeAsync: async () => {},
  Recording: {
    createAsync: async () => ({
      startAsync: async () => {},
      stopAndUnloadAsync: async () => ({ sound: {}, status: {} }),
      getStatusAsync: async () => ({ canRecord: false }),
    }),
  },
};

export default {
  Video,
  Audio,
};

