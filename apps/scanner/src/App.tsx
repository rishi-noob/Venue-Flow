import { Routes, Route, Navigate } from "react-router-dom";
import { getStoredUser } from "./lib/api";
import Login from "./pages/Login";
import Scan from "./pages/Scan";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = getStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <Scan />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/scan" replace />} />
    </Routes>
  );
}
