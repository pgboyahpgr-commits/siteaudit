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
import Reversiy from "./components/Reversiy.jsx";
import TourOverlay from "./components/TourOverlay.jsx";
import { getToken, logout } from "./api.js";

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
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
        <nav className="nav">
          <Link to="/" className="brand">
            <span className="brand-mark">▣</span>
            <span>
              <span className="brand-name">
                SITE<em>AUDIT</em>
              </span>
              <span className="brand-sub">AI Security · Privacy · Trust Agent</span>
            </span>
          </Link>
          <div className="nav-links">
            <Link to="/" className="nav-pill">SCANNER</Link>
            <Link to="/detector" className="nav-pill">AI IMAGE DETECTOR</Link>
            <Link to="/url-engineer" className="nav-pill">URL ENGINEER</Link>
            <Link to="/settings" className="nav-pill">⚙ SETTINGS</Link>
            <Link to="/guide" className="nav-pill">📖 GUIDE</Link>
            <Link to="/faq" className="nav-pill">FAQ</Link>
            {authed ? (
              <>
                <Link to="/my" className="nav-pill">MY SCANS</Link>
                <Link to="/history" className="nav-pill">📊 HISTORY</Link>
                <button className="nav-pill" onClick={signOut}>LOG OUT</button>
              </>
            ) : (
              <Link to="/auth" className="nav-pill">SIGN IN</Link>
            )}
            <a className="nav-pill live" href="/">
              <span className="dot" />
              SYSTEM ACTIVE
            </a>
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
