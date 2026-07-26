// Заглушка для expo-image-picker на вебе
export const launchImageLibraryAsync = async (options) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve({ cancelled: true });
      return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        resolve({ cancelled: true });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const uri = event.target.result;
        // Создаем объект изображения для получения размеров
        const img = new Image();
        img.onload = () => {
          resolve({
            cancelled: false,
            canceled: false,
            assets: [{
              uri,
              width: img.width,
              height: img.height,
              type: file.type,
              fileName: file.name,
              fileSize: file.size,
            }],
          });
        };
        img.onerror = () => {
          resolve({
            cancelled: false,
            canceled: false,
            assets: [{
              uri,
              width: 0,
              height: 0,
              type: file.type,
              fileName: file.name,
              fileSize: file.size,
            }],
          });
        };
        img.src = uri;
      };
      reader.readAsDataURL(file);
    };
    
    input.oncancel = () => {
      resolve({ cancelled: true });
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
};

export const launchCameraAsync = async () => {
  // На вебе камера не поддерживается
  return { cancelled: true };
};

export const requestMediaLibraryPermissionsAsync = async () => ({ status: 'granted' });
export const requestCameraPermissionsAsync = async () => ({ status: 'denied' });

export default {
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
};
