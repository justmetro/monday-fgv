import { Link } from '@tanstack/react-router';

export default function App() {
  return (
    <div className="p-6 text-sm">
      <Link to="/" className="text-primary underline">Abrir o Painel gerencial</Link>
    </div>
  );
}
