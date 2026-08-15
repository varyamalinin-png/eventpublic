import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@vkontakte/vkui/dist/vkui.css';
import './brand.css';
import './landing.css';

createRoot(document.getElementById('root')!).render(<App />);
