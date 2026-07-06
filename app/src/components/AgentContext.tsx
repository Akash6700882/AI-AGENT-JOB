import { createContext, useContext } from "react";
import { useAgent } from "../hooks/useAgent"; // ✅ FIXED PATH

const AgentContext = createContext<any>(null);

export function AgentProvider({ children }: any) {
  const agent = useAgent();

  return (
    <AgentContext.Provider value={agent}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  return useContext(AgentContext);
}