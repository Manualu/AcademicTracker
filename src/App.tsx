import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BottomNav, NetBar, Toasts } from "./components/ui";
import { StoreProvider, useStore } from "./lib/store";
import { TimerProvider } from "./lib/timer";
import Carrera from "./screens/Carrera";
import Estudiar from "./screens/Estudiar";
import Examenes from "./screens/Examenes";
import Home from "./screens/Home";
import Login from "./screens/Login";
import Perfil from "./screens/Perfil";
import Ranking from "./screens/Ranking";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function Shell() {
  const { ready, userId } = useStore();
  useEffect(() => { window.scrollTo(0, 0); }, [userId]);
  if (!ready) return <div className="splash"><span>Remontada<b>.</b></span></div>;
  if (!userId) return <div className="app"><Login /></div>;
  return (
    <TimerProvider>
      <Toasts />
      <div className="app">
        <NetBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/estudiar" element={<Estudiar />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/examenes" element={<Examenes />} />
          <Route path="/carrera" element={<Carrera />} />
          <Route path="/perfil/:id" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </TimerProvider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <ScrollToTop />
        <Shell />
      </StoreProvider>
    </HashRouter>
  );
}
