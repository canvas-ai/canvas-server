'use strict';

import BaseLLMConnector from './BaseLLMConnector.js';

/**
 * OpenAI GPT LLM Connector
 */
class OpenAIConnector extends BaseLLMConnector {

    constructor(config) {
        super(config);

        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
        this.model = config.model || 'gpt-4o';
        this.maxTokens = config.maxTokens || 4096;
        this.baseURL = config.baseURL || 'https://api.openai.com/v1';

        // Validate configuration
        this.validateConfig(['apiKey']);
    }

    /**
     * Chat with GPT
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Chat options
     * @returns {Promise<Object>} Response object
     */
    async chat(messages, options = {}) {
        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            const { default: fetch } = await import('node-fetch');

            const formattedMessages = this.formatMessages(messages);
            const model = options.model || this.model;
            const maxTokens = options.maxTokens || this.maxTokens;

            const requestBody = {
                model: model,
                messages: formattedMessages,
                max_tokens: maxTokens,
                temperature: options.temperature || 0.7
            };

            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();

            return {
                content: data.choices[0]?.message?.content || '',
                usage: data.usage,
                model: data.model,
                metadata: {
                    provider: 'openai',
                    model: data.model,
                    usage: data.usage,
                    finish_reason: data.choices[0]?.finish_reason
                }
            };
        } catch (error) {
            this.handleError(error, 'chat');
        }
    }

    /**
     * Check if OpenAI is available
     * @returns {Promise<boolean>} Availability status
     */
    async isAvailable() {
        try {
            if (!this.apiKey) {
                return false;
            }

            // Simple test call to check API connectivity
            const { default: fetch } = await import('node-fetch');

            const response = await fetch(`${this.baseURL}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                }
            });

            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Format messages for OpenAI API
     * @param {Array} messages - Input messages
     * @returns {Array} Formatted messages
     */
    formatMessages(messages) {
        return messages.map(msg => ({
            role: msg.role, // OpenAI supports system, user, assistant roles
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }));
    }

    /**
     * Get available models
     * @returns {Array} Array of available models
     */
    getAvailableModels() {
        return [
            'gpt-4o',
            'gpt-4o-mini',
            'gpt-4-turbo',
            'gpt-4',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k'
        ];
    }

    /**
     * List models from OpenAI API
     * @returns {Promise<Array>} Available models from API
     */
    async listModels() {
        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            const { default: fetch } = await import('node-fetch');

            const response = await fetch(`${this.baseURL}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }

            const data = await response.json();
            return data.data.map(model => ({
                id: model.id,
                created: model.created,
                owned_by: model.owned_by
            }));
        } catch (error) {
            this.handleError(error, 'listModels');
        }
    }
}

export default OpenAIConnector;
