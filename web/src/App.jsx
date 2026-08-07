import { useState, lazy, Suspense } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import MyScansPage from "./pages/MyScansPage.jsx";
import FaqPage from "./pages/FaqPage.jsx";
const DetectorPage = lazy(() => import("./pages/DetectorPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
import TermsPage from "./pages/TermsPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import GuidePage from "./pages/GuidePage.jsx";
import ScanHistoryPage from "./pages/ScanHistoryPage.jsx";
import UrlEngineerPage from "./pages/UrlEngineerPage.jsx";
const ComparePage = lazy(() => import("./pages/ComparePage.jsx"));
const KeyInspectorPage = lazy(() => import("./pages/KeyInspectorPage.jsx"));
import Reversiy from "./components/Reversiy.jsx";
import TourOverlay from "./components/TourOverlay.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { getToken, logout } from "./api.js";

const PageLoader = () => <div className="center mt" style={{ padding: 60 }}><div className="loading"><span className="spinner" /> loading...</div></div>;

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [isLight, setIsLight] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sa_theme");
      if (saved === "light") { document.documentElement.classList.add("light-mode"); return true; }
    }
    return false;
  });
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useNavigate();

  function onAuthed() {
    setAuthed(!!getToken());
  }

  function signOut() {
    logout();
    setAuthed(false);
    navigate("/");
  }

  return (
    <ErrorBoundary>
    <>
      <div className="bg-grid" />
      <div className="bg-noise" />
      <div className="crt-vignette" />
      <div className="scanlines" />
      <div className="app">
        <nav className={`nav ${navOpen ? "nav-open" : ""}`}>
          <Link to="/" className="brand">
            <span className="brand-mark">▣</span>
            <span>
              <span className="brand-name">
                SITE<em>AUDIT</em>
              </span>
              <span className="brand-sub">AI Security · Privacy · Trust Agent</span>
            </span>
          </Link>
          <button className="nav-hamburger" onClick={() => setNavOpen((o) => !o)}>
            ☰
          </button>
          <div className="nav-links">
            <Link to="/" className="nav-pill" onClick={() => setNavOpen(false)}>SCANNER</Link>
            <Link to="/detector" className="nav-pill" onClick={() => setNavOpen(false)}>AI IMAGE DETECTOR</Link>
            <Link to="/url-engineer" className="nav-pill" onClick={() => setNavOpen(false)}>URL ENGINEER</Link>
            <Link to="/key-inspector" className="nav-pill" onClick={() => setNavOpen(false)}>🔑 KEY INSPECTOR</Link>
            <Link to="/compare" className="nav-pill" onClick={() => setNavOpen(false)}>⚔ COMPARE</Link>
            <Link to="/settings" className="nav-pill" onClick={() => setNavOpen(false)}>⚙ SETTINGS</Link>
            <Link to="/guide" className="nav-pill" onClick={() => setNavOpen(false)}>📖 GUIDE</Link>
            <Link to="/faq" className="nav-pill" onClick={() => setNavOpen(false)}>FAQ</Link>
            {authed ? (
              <>
                <Link to="/my" className="nav-pill" onClick={() => setNavOpen(false)}>MY SCANS</Link>
                <Link to="/history" className="nav-pill" onClick={() => setNavOpen(false)}>📊 HISTORY</Link>
                <button className="nav-pill" onClick={() => { setNavOpen(false); signOut(); }}>LOG OUT</button>
              </>
            ) : (
              <Link to="/auth" className="nav-pill" onClick={() => setNavOpen(false)}>SIGN IN</Link>
            )}
            <button className="nav-pill" onClick={() => {
              const next = !isLight;
              setIsLight(next);
              document.documentElement.classList.toggle("light-mode", next);
              localStorage.setItem("sa_theme", next ? "light" : "dark");
            }} style={{ cursor: "pointer" }}>
              {isLight ? "☀️" : "🌙"}
            </button>
            <Link to="/" className="nav-pill live">
              <span className="dot" />
              SYSTEM ACTIVE
            </Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
          <Route path="/detector" element={<Suspense fallback={<PageLoader />}><ErrorBoundary><DetectorPage /></ErrorBoundary></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageLoader />}><ErrorBoundary><SettingsPage /></ErrorBoundary></Suspense>} />
          <Route path="/scan/:id" element={<ErrorBoundary><ScanPage /></ErrorBoundary>} />
          <Route path="/auth" element={<ErrorBoundary><AuthPage onAuthed={onAuthed} /></ErrorBoundary>} />
          <Route path="/my" element={<ErrorBoundary><MyScansPage onAuthed={onAuthed} /></ErrorBoundary>} />
          <Route path="/faq" element={<ErrorBoundary><FaqPage /></ErrorBoundary>} />
          <Route path="/terms" element={<ErrorBoundary><TermsPage /></ErrorBoundary>} />
          <Route path="/privacy" element={<ErrorBoundary><PrivacyPage /></ErrorBoundary>} />
          <Route path="/guide" element={<ErrorBoundary><GuidePage /></ErrorBoundary>} />
          <Route path="/history" element={<ErrorBoundary><ScanHistoryPage /></ErrorBoundary>} />
          <Route path="/url-engineer" element={<ErrorBoundary><UrlEngineerPage /></ErrorBoundary>} />
          <Route path="/compare" element={<Suspense fallback={<PageLoader />}><ErrorBoundary><ComparePage /></ErrorBoundary></Suspense>} />
          <Route path="/key-inspector" element={<Suspense fallback={<PageLoader />}><ErrorBoundary><KeyInspectorPage /></ErrorBoundary></Suspense>} />
        </Routes>

        <footer className="footer">
          <span style={{ fontWeight: 700, letterSpacing: 1 }}>
            SITEAUDIT v2.0 // <span className="hl">AI-powered security, privacy &amp; trust</span>
          </span>
          <span>
            <Link to="/terms" className="hl">Terms</Link> · <Link to="/privacy" className="hl">Privacy</Link>
          </span>
        </footer>

        <Reversiy />
        <TourOverlay />
      </div>
    </>
    </ErrorBoundary>
  );
}
