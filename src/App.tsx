import { useAppController } from './hooks/useAppController';
import { AppLayout } from './components/AppLayout';
import { IpokerCatalogTest } from './components/IpokerCatalogTest';

export default function App() {
  if (new URLSearchParams(window.location.search).get('ipokerTest') === '1') {
    return <IpokerCatalogTest />;
  }
  const controller = useAppController();
  return <AppLayout {...controller} />;
}
