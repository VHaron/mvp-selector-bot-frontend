import { useAppController } from './hooks/useAppController';
import { AppLayout } from './components/AppLayout';

export default function App() {
  const controller = useAppController();
  return <AppLayout {...controller} />;
}
