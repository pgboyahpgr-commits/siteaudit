export const agentContext = {
  scanId: null,
  targetUrl: null,
  page: null,
};

export function setAgentContext(next) {
  Object.assign(agentContext, next);
}
