// Layout.jsx
import React, { useState } from "react";
import Toolbar from "./Toolbar";
import DashboardHeader from "./DashboardHeader";
import { Outlet } from "react-router-dom";
import "../styles/Layout.scss";

const Layout = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="layout-container">
      <DashboardHeader onMenuToggle={() => setMobileNavOpen(prev => !prev)} />
      <div className="main-content">
        <div className={`sidebar-wrapper${mobileNavOpen ? " mobile-open" : ""}`}>
          <Toolbar onLinkClick={() => setMobileNavOpen(false)} />
        </div>
        {mobileNavOpen && (
          <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
        )}
        <div className="content-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
