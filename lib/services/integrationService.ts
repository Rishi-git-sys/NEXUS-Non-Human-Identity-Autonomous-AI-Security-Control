import { mockIntegrations } from '../mock/integrations';
import { Integration } from '../types/integration';

const integrationsState: Integration[] = [...mockIntegrations];

export const integrationService = {
  getIntegrations(): Integration[] {
    return integrationsState;
  },

  toggleIntegration(id: string): { success: boolean; message: string; integration?: Integration } {
    const integrationIndex = integrationsState.findIndex((int) => int.id === id);
    if (integrationIndex === -1) {
      return { success: false, message: 'Integration not found.' };
    }

    const currentStatus = integrationsState[integrationIndex].status;
    let newStatus: Integration['status'] = 'Available';

    if (currentStatus === 'Connected') {
      newStatus = 'Available';
    } else if (currentStatus === 'Available') {
      newStatus = 'Connected';
    } else {
      // Coming soon cannot be toggled
      return { success: false, message: 'This integration is not yet available.' };
    }

    integrationsState[integrationIndex] = {
      ...integrationsState[integrationIndex],
      status: newStatus
    };

    return {
      success: true,
      message: `Integration ${newStatus === 'Connected' ? 'connected' : 'disconnected'} successfully.`,
      integration: integrationsState[integrationIndex]
    };
  }
};
