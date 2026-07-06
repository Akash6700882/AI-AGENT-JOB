import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AgentProvider } from "./components/AgentContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AgentProvider>
      <App />
    </AgentProvider>
  </BrowserRouter>
);

