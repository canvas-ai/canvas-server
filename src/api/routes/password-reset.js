'use strict';

import { resetPassword } from '../auth/strategies.js';
import ResponseObject from '../ResponseObject.js';

/**
 * Password reset routes handler
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
export default async function passwordResetRoutes(fastify, options) {
  
  // Password reset page (HTML)
  fastify.get('/reset-password/:token', {
    schema: {
      params: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { token } = request.params;
    
    // Return HTML page for password reset
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - Canvas</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            text-align: center;
            max-width: 400px;
            width: 90%;
        }
        .reset-icon {
            color: #3b82f6;
            font-size: 48px;
            margin-bottom: 20px;
        }
        h1 {
            color: #1f2937;
            margin-bottom: 16px;
            font-size: 24px;
        }
        p {
            color: #6b7280;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #374151;
            font-weight: 500;
        }
        input[type="password"] {
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 16px;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }
        input[type="password"]:focus {
            outline: none;
            border-color: #3b82f6;
        }
        .password-requirements {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 12px;
            margin: 16px 0;
            font-size: 14px;
            color: #6b7280;
            text-align: left;
        }
        .password-requirements ul {
            margin: 8px 0;
            padding-left: 20px;
        }
        .reset-button {
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
            transition: background-color 0.2s;
        }
        .reset-button:hover {
            background: #2563eb;
        }
        .reset-button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        .error {
            color: #dc2626;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            display: none;
        }
        .success {
            color: #059669;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
            display: none;
        }
        .login-link {
            margin-top: 20px;
        }
        .login-link a {
            color: #3b82f6;
            text-decoration: none;
        }
        .login-link a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="reset-icon">🔒</div>
        <h1>Reset Your Password</h1>
        <p>Enter your new password below. Make sure it's strong and secure.</p>
        
        <div class="error" id="error-message"></div>
        <div class="success" id="success-message"></div>
        
        <form id="reset-form">
            <div class="form-group">
                <label for="new-password">New Password</label>
                <input type="password" id="new-password" name="newPassword" required minlength="12">
            </div>
            
            <div class="form-group">
                <label for="confirm-password">Confirm Password</label>
                <input type="password" id="confirm-password" name="confirmPassword" required minlength="12">
            </div>
            
            <div class="password-requirements">
                <strong>Password Requirements:</strong>
                <ul>
                    <li>At least 12 characters long</li>
                    <li>Include uppercase and lowercase letters</li>
                    <li>Include numbers</li>
                    <li>Include special characters</li>
                </ul>
            </div>
            
            <button type="submit" class="reset-button" id="reset-button">Reset Password</button>
        </form>
        
        <div class="login-link">
            <a href="/login">Back to Login</a>
        </div>
    </div>

    <script>
        const form = document.getElementById('reset-form');
        const errorMessage = document.getElementById('error-message');
        const successMessage = document.getElementById('success-message');
        const resetButton = document.getElementById('reset-button');
        
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            successMessage.style.display = 'none';
        }
        
        function showSuccess(message) {
            successMessage.textContent = message;
            successMessage.style.display = 'block';
            errorMessage.style.display = 'none';
        }
        
        function validatePassword(password) {
            const minLength = password.length >= 12;
            const hasUpper = /[A-Z]/.test(password);
            const hasLower = /[a-z]/.test(password);
            const hasNumber = /\\d/.test(password);
            const hasSpecial = /[!@#$%^&*()_+\\-=\\[\\]{};':"\\\\|,.<>\\/?]/.test(password);
            
            return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Clear previous messages
            errorMessage.style.display = 'none';
            successMessage.style.display = 'none';
            
            // Validate passwords match
            if (newPassword !== confirmPassword) {
                showError('Passwords do not match');
                return;
            }
            
            // Validate password strength
            if (!validatePassword(newPassword)) {
                showError('Password does not meet requirements');
                return;
            }
            
            // Disable button
            resetButton.disabled = true;
            resetButton.textContent = 'Resetting...';
            
            try {
                const response = await fetch('/api/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        token: '${token}',
                        newPassword: newPassword
                    })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showSuccess('Password reset successfully! Redirecting to login...');
                    form.style.display = 'none';
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    showError(result.message || 'Failed to reset password');
                }
            } catch (error) {
                showError('Network error. Please try again.');
            } finally {
                resetButton.disabled = false;
                resetButton.textContent = 'Reset Password';
            }
        });
    </script>
</body>
</html>`;

    reply.type('text/html').send(html);
  });

  // API endpoint for password reset
  fastify.post('/api/reset-password', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string' },
          newPassword: { type: 'string', minLength: 12 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { token, newPassword } = request.body;
      
      const result = await resetPassword(token, newPassword, fastify.userManager);
      
      const response = new ResponseObject().success({
        success: true
      }, 'Password reset successfully');
      
      return reply.code(response.statusCode).send(response.getResponse());
      
    } catch (error) {
      fastify.log.error('[Password Reset API] Error:', error.message);
      
      if (error.code === 'ERR_INVALID_TOKEN') {
        const response = new ResponseObject().badRequest('Invalid or expired reset token');
        return reply.code(response.statusCode).send(response.getResponse());
      }
      
      const response = new ResponseObject().serverError('Failed to reset password');
      return reply.code(response.statusCode).send(response.getResponse());
    }
  });
}