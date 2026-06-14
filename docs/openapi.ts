export const openApiDoc = {
  openapi: '3.1.0',
  info: {
    title: 'OrderKuota Private API',
    version: '1.0.0',
    description:
      'Private proxy gateway for OrderKuota QRIS payments (Bun + SQLite). All /api routes except /api/health require the X-API-Key header.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        security: [],
        responses: { '200': { description: 'Service is up' } },
      },
    },
    '/api/auth/otp': {
      post: {
        summary: 'Request OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: { username: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'OTP requested' } },
      },
    },
    '/api/auth/token': {
      post: {
        summary: 'Exchange OTP for token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'otp'],
                properties: { username: { type: 'string' }, otp: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Token issued' } },
      },
    },
    '/api/qris/generate': {
      post: {
        summary: 'Generate dynamic QRIS from a static QRIS',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'token', 'amount', 'qris_static'],
                properties: {
                  username: { type: 'string' },
                  token: { type: 'string' },
                  amount: { type: 'integer', example: 10000 },
                  qris_static: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Pending transaction created' } },
      },
    },
    '/api/qris/check': {
      post: {
        summary: 'Check payment status',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'token', 'transaction_id'],
                properties: {
                  username: { type: 'string' },
                  token: { type: 'string' },
                  transaction_id: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Payment status (pending/paid/expired/not_found)' } },
      },
    },
    '/api/qris/image': {
      post: {
        summary: 'Render a QRIS string to a QR PNG data URL',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['qris_string'],
                properties: {
                  qris_string: { type: 'string' },
                  size: { type: 'integer', default: 300 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'data_url returned' } },
      },
    },
    '/api/account/balance': {
      post: {
        summary: 'Account balance',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'token'],
                properties: { username: { type: 'string' }, token: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Balance returned' } },
      },
    },
  },
} as const;
