import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ReviewGrid from "./pages/ReviewGrid";
import Consensus from "./pages/Consensus";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/review" element={<ReviewGrid />} />
        <Route path="/consensus" element={<Consensus />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
