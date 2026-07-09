import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './pages/Layout';
import Home from './pages/Home';
import KBDetail from './pages/KBDetail';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/kb/:kbId" element={<KBDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
