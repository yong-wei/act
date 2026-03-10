type SimulationRequest = {
  simType: string;
  inputParams: Record<string, unknown>;
  contextId?: string;
};

type SimulationResponse = {
  status: 'ok' | 'error';
  outputData?: unknown;
  artifacts?: unknown;
  error?: string;
};

const getSimulationBaseUrl = () =>
  process.env.SIM_SERVICE_URL ?? 'http://localhost:7001';

export async function runSimulation(
  payload: SimulationRequest,
): Promise<SimulationResponse> {
  const response = await fetch(`${getSimulationBaseUrl()}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return {
      status: 'error',
      error: `Simulation service error (${response.status})`,
    };
  }

  return response.json();
}
