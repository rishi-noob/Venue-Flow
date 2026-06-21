import { Routes, Route, Navigate } from "react-router-dom";
import { getStoredUser } from "./lib/api";
import Login from "./pages/Login";
import Events from "./pages/Events";
import EventNew from "./pages/EventNew";
import EventDetail from "./pages/EventDetail";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = getStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "volunteer") return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <Events />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/new"
        element={
          <ProtectedRoute>
            <EventNew />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <ProtectedRoute>
            <EventDetail />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}
