import "./App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Auth from "./pages/Auth";
import ParentDashboard from "./pages/ParentDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import PatronDashboard from "./pages/PatronDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function Loader() {
  return <div className="min-h-screen flex items-center justify-center bg-[#F9F9F8]"><div className="w-8 h-8 border-2 border-[#1A4331] border-t-transparent rounded-full animate-spin" /></div>;
}

const home = { parent: "/parent", student: "/student", patron: "/patron", admin: "/admin" };

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <Loader />;
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to={home[user.role]} replace />;
  return children;
}

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (user) return <Navigate to={home[user.role]} replace />;
  return <Auth />;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/parent" element={<Protected role="parent"><ParentDashboard /></Protected>} />
            <Route path="/student" element={<Protected role="student"><StudentDashboard /></Protected>} />
            <Route path="/patron" element={<Protected role="patron"><PatronDashboard /></Protected>} />
            <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
