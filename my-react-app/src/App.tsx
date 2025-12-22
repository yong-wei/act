import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./components/Home";
import PidSimulator from "./components/PidSimulator";
import Ai from "./components/Ai";
import Ethics from "./components/Ethics";
import Knowledge from "./components/Knowledge";
import ArgumentPrinciple from "./components/ArgumentPrinciple";
import Background from "./components/Background";
import Personal from "./components/Personal";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="ai" element={<Ai />} />
          <Route path="ethics" element={<Ethics />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="pid-simulator" element={<PidSimulator />} />
          <Route path="argument-principle" element={<ArgumentPrinciple />} />
          <Route path="background" element={<Background />} />
          <Route path="personal" element={<Personal />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
