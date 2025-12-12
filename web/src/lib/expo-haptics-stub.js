// Заглушка для expo-haptics
export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
};

export const impactAsync = async (style = ImpactFeedbackStyle.Medium) => {
  // No-op для веба
};

export default {
  notificationAsync: async () => {},
  impactAsync,
  ImpactFeedbackStyle,
};

