/**
 * ============================================
 * HUBSPOT CONFIGURATION
 * ============================================
 * Configuração base para integração com HubSpot CRM
 * Token: 12574f39-fb3c-4e80-9893-732105382603
 *
 * Uso: Copie este arquivo para projetos futuros que precisem
 * de integração com HubSpot
 */

const HUBSPOT_CONFIG = {
  // Private App Token (substituir por variável de ambiente em produção)
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN || '12574f39-fb3c-4e80-9893-732105382603',

  // URLs da API
  baseUrl: 'https://api.hubapi.com',

  // Endpoints comuns
  endpoints: {
    contacts: '/crm/v3/objects/contacts',
    companies: '/crm/v3/objects/companies',
    deals: '/crm/v3/objects/deals',
    lists: '/crm/v3/lists',
    events: '/events/v3/events'
  }
};

/**
 * Criar ou atualizar contato no HubSpot
 */
async function createHubSpotContact(email, firstname, lastname, properties = {}) {
  const url = `${HUBSPOT_CONFIG.baseUrl}${HUBSPOT_CONFIG.endpoints.contacts}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_CONFIG.accessToken}`
      },
      body: JSON.stringify({
        properties: {
          email,
          firstname,
          lastname,
          ...properties
        }
      })
    });

    if (response.status === 409) {
      // Contato já existe
      console.log('Contact already exists');
      return { success: true, existing: true };
    }

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, contactId: data.id };

  } catch (error) {
    console.error('HubSpot Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar contato por email
 */
async function getContactByEmail(email) {
  const url = `${HUBSPOT_CONFIG.baseUrl}/crm/v3/objects/contacts/search`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_CONFIG.accessToken}`
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, contacts: data.results };

  } catch (error) {
    console.error('HubSpot Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Criar evento de engajamento
 */
async function createEvent(email, eventName, properties = {}) {
  const url = `${HUBSPOT_CONFIG.baseUrl}${HUBSPOT_CONFIG.endpoints.events}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HUBSPOT_CONFIG.accessToken}`
      },
      body: JSON.stringify({
        email,
        eventName,
        properties,
        occurredAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    return { success: true };

  } catch (error) {
    console.error('HubSpot Event Error:', error);
    return { success: false, error: error.message };
  }
}

// Exportar funções
module.exports = {
  HUBSPOT_CONFIG,
  createHubSpotContact,
  getContactByEmail,
  createEvent
};
