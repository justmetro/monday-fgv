import { Toaster as T } from 'sonner';
export function Toaster(props) {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return <T theme={dark ? 'dark' : 'light'} richColors closeButton {...props} />;
}
