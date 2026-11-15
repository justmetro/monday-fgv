import { Toaster as Sonner, type ToasterProps } from 'sonner';
const Toaster = ({ ...props }: ToasterProps) => {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return <Sonner theme={dark ? 'dark' : 'light'} className="toaster group" richColors closeButton position="bottom-right" {...props} />;
};
export { Toaster };
