'use strict';

import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { createDebug } from '@/utils/log/index.js';
const debug = createDebug('utils:swagger');

/**
 * Swagger configuration
 * @returns {Object} Swagger configuration
 */
export function setupSwagger() {
    // Swagger definition
    const swaggerDefinition = {
        openapi: '3.0.0',
        info: {
            title: 'Canvas API',
            version: '2.0.0',
            description: 'Canvas Server API Documentation',
            license: {
                name: 'Proprietary',
                url: 'https://getcanvas.org/license',
            },
            contact: {
                name: 'Canvas Support',
                url: 'https://getcanvas.org/support',
                email: 'support@getcanvas.org',
            },
        },
        servers: [
            {
                url: '/api/v2',
                description: 'Canvas API v2',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    };

    // Options for the swagger docs
    const options = {
        swaggerDefinition,
        // Path to the API docs
        apis: [
            './src/transports/http/routes/v2/*.js',
            './src/transports/http/routes/v2/**/*.js',
        ],
    };

    // Initialize swagger-jsdoc
    const swaggerSpec = swaggerJSDoc(options);

    // Setup swagger routes
    const setupRoutes = (app) => {
        // Serve swagger docs - ensure these routes are NOT protected by authentication
        // Mount at root path to avoid authentication middleware
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
            explorer: true,
            customCss: '.swagger-ui .topbar { display: none }',
        }));

        // Serve swagger spec as JSON
        app.get('/api-docs.json', (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(swaggerSpec);
        });

        debug('Swagger documentation available at /api-docs');
    };

    return {
        setupRoutes,
        swaggerSpec,
    };
}

export default setupSwagger;
