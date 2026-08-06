import { useState } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import MyScansPage from "./pages/MyScansPage.jsx";
import FaqPage from "./pages/FaqPage.jsx";
import DetectorPage from "./pages/DetectorPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import GuidePage from "./pages/GuidePage.jsx";
import ScanHistoryPage from "./pages/ScanHistoryPage.jsx";
import UrlEngineerPage from "./pages/UrlEngineerPage.jsx";
import ComparePage from "./pages/ComparePage.jsx";
import Reversiy from "./components/Reversiy.jsx";
import TourOverlay from "./components/TourOverlay.jsx";
import { getToken, logout } from "./api.js";

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
          <Route path="/" element={<HomePage />} />
          <Route path="/detector" element={<DetectorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/scan/:id" element={<ScanPage />} />
          <Route path="/auth" element={<AuthPage onAuthed={onAuthed} />} />
          <Route path="/my" element={<MyScansPage onAuthed={onAuthed} />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/history" element={<ScanHistoryPage />} />
          <Route path="/url-engineer" element={<UrlEngineerPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>

        <footer className="footer">
          <span>SITEAUDIT v0.3 // <span className="hl">AI-powered security, privacy &amp; trust</span></span>
          <span>
            <Link to="/terms" className="hl">Terms</Link> · <Link to="/privacy" className="hl">Privacy</Link>
          </span>
        </footer>

        <Reversiy />
        <TourOverlay />
      </div>
    </>
  );
}
