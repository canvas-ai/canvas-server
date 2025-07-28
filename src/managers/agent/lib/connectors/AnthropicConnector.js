'use strict';

import BaseLLMConnector from './BaseLLMConnector.js';

/**
 * Anthropic Claude LLM Connector
 */
class AnthropicConnector extends BaseLLMConnector {

    constructor(config) {
        super(config);

        this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
        this.model = config.model || 'claude-3-5-sonnet-20241022';
        this.maxTokens = config.maxTokens || 4096;
        this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';

        // Validate configuration
        this.validateConfig(['apiKey']);
    }

    /**
     * Chat with Claude
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Chat options
     * @returns {Promise<Object>} Response object
     */
    async chat(messages, options = {}) {
        try {
            if (!this.apiKey) {
                throw new Error('Anthropic API key not configured');
            }

            const { default: fetch } = await import('node-fetch');

            const formattedMessages = this.formatMessages(messages);
            const model = options.model || this.model;
            const maxTokens = options.maxTokens || this.maxTokens;

            const response = await fetch(`${this.baseURL}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: maxTokens,
                    messages: formattedMessages
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            return {
                content: data.content[0]?.text || '',
                usage: data.usage,
                model: data.model,
                metadata: {
                    provider: 'anthropic',
                    model: data.model,
                    usage: data.usage
                }
            };
        } catch (error) {
            this.handleError(error, 'chat');
        }
    }

    /**
     * Check if Anthropic is available
     * @returns {Promise<boolean>} Availability status
     */
    async isAvailable() {
        try {
            if (!this.apiKey) {
                return false;
            }

            // Simple test call to check API connectivity
            const { default: fetch } = await import('node-fetch');

            const response = await fetch(`${this.baseURL}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 1,
                    messages: [{
                        role: 'user',
                        content: 'test'
                    }]
                })
            });

            return response.ok || response.status === 400; // 400 might be rate limit but API is available
        } catch (error) {
            return false;
        }
    }

    /**
     * Format messages for Anthropic API
     * @param {Array} messages - Input messages
     * @returns {Array} Formatted messages
     */
    formatMessages(messages) {
        return messages.map(msg => {
            // Anthropic expects specific roles
            let role = msg.role;
            if (role === 'system') {
                // Anthropic handles system messages differently, we'll prepend to first user message
                role = 'user';
            }

            return {
                role: role,
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            };
        });
    }

    /**
     * Get available models
     * @returns {Array} Array of available models
     */
    getAvailableModels() {
        return [
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022',
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307'
        ];
    }
}

export default AnthropicConnector;
