#!/usr/bin/env node

/**
 * Test script for email verification functionality
 * This script demonstrates the email verification system
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const TEST_CONFIG = {
  email: 'test@example.com',
  name: 'testuser',
  password: 'SecurePass123!',
  baseUrl: 'http://localhost:8001'
};

/**
 * Test email verification flow
 */
async function testEmailVerification() {
  console.log('🧪 Testing Email Verification System\n');

  // 1. Test configuration files
  console.log('1. Checking configuration files...');
  await testConfigurationFiles();

  // 2. Test user registration
  console.log('\n2. Testing user registration...');
  const registrationResult = await testUserRegistration();

  // 3. Test email verification request
  console.log('\n3. Testing email verification request...');
  await testEmailVerificationRequest();

  // 4. Test password reset flow
  console.log('\n4. Testing password reset flow...');
  await testPasswordReset();

  console.log('\n✅ Email verification tests completed!');
}

/**
 * Test configuration files exist and are valid
 */
async function testConfigurationFiles() {
  try {
    // Check auth config
    const authConfigPath = path.join(process.cwd(), 'server/config/auth.json');
    if (fs.existsSync(authConfigPath)) {
      const authConfig = JSON.parse(fs.readFileSync(authConfigPath, 'utf8'));
      console.log('   ✅ Auth configuration found');
      console.log(`   📧 Email verification: ${authConfig.strategies?.local?.requireEmailVerification ? 'Enabled' : 'Disabled'}`);
      console.log(`   🔒 Password policy: ${authConfig.strategies?.local?.passwordPolicy?.minLength || 8} chars minimum`);
    } else {
      console.log('   ❌ Auth configuration not found');
    }

    // Check SMTP config
    const smtpConfigPath = path.join(process.cwd(), 'server/config/smtp.json');
    if (fs.existsSync(smtpConfigPath)) {
      const smtpConfig = JSON.parse(fs.readFileSync(smtpConfigPath, 'utf8'));
      console.log('   ✅ SMTP configuration found');
      console.log(`   📧 Email service: ${smtpConfig.enabled ? 'Enabled' : 'Disabled'}`);
      if (smtpConfig.enabled) {
        console.log(`   📮 SMTP host: ${smtpConfig.host}:${smtpConfig.port}`);
      }
    } else {
      console.log('   ❌ SMTP configuration not found');
    }
  } catch (error) {
    console.log(`   ❌ Error reading configuration: ${error.message}`);
  }
}

/**
 * Test user registration API
 */
async function testUserRegistration() {
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: TEST_CONFIG.name,
        email: TEST_CONFIG.email,
        password: TEST_CONFIG.password
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Registration successful');
      console.log(`   👤 User ID: ${result.data.user.id}`);
      console.log(`   📧 Email verified: ${result.data.user.emailVerified}`);
      console.log(`   🔗 Verification required: ${result.data.requireEmailVerification}`);
      return result;
    } else {
      console.log(`   ❌ Registration failed: ${result.message}`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Registration error: ${error.message}`);
    return null;
  }
}

/**
 * Test email verification request API
 */
async function testEmailVerificationRequest() {
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth/request-email-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_CONFIG.email
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Email verification request successful');
      console.log(`   📧 Message: ${result.message}`);
    } else {
      console.log(`   ❌ Email verification request failed: ${result.message}`);
    }
  } catch (error) {
    console.log(`   ❌ Email verification request error: ${error.message}`);
  }
}

/**
 * Test password reset flow
 */
async function testPasswordReset() {
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_CONFIG.email
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('   ✅ Password reset request successful');
      console.log(`   📧 Message: ${result.message}`);
    } else {
      console.log(`   ❌ Password reset request failed: ${result.message}`);
    }
  } catch (error) {
    console.log(`   ❌ Password reset request error: ${error.message}`);
  }
}

/**
 * Generate sample email templates
 */
function generateSampleTemplates() {
  console.log('\n📧 Sample Email Templates:');
  
  const verificationTemplate = `
Subject: Verify your Canvas account

Hello {userName},

Welcome to Canvas! Please click the link below to verify your email address:

{verificationUrl}

This link will expire in 48 hours.

If you didn't create this account, you can safely ignore this email.

Best regards,
The Canvas Team
`;

  const resetTemplate = `
Subject: Reset your Canvas password

Hello {userName},

You requested a password reset for your Canvas account. Click the link below to set a new password:

{resetUrl}

This link will expire in 24 hours.

If you didn't request this reset, you can safely ignore this email.

Best regards,
The Canvas Team
`;

  console.log('\n📧 Verification Email:');
  console.log(verificationTemplate);
  
  console.log('\n🔒 Password Reset Email:');
  console.log(resetTemplate);
}

/**
 * Show configuration instructions
 */
function showConfigurationInstructions() {
  console.log('\n📋 Configuration Instructions:');
  console.log('\n1. Enable email verification:');
  console.log('   Edit server/config/auth.json and set:');
  console.log('   "requireEmailVerification": true');
  
  console.log('\n2. Configure SMTP:');
  console.log('   Edit server/config/smtp.json and set:');
  console.log('   "enabled": true');
  console.log('   "host": "your-smtp-server.com"');
  console.log('   "port": 587');
  console.log('   "secure": true');
  console.log('   "auth": { "user": "your-email", "pass": "your-password" }');
  
  console.log('\n3. Set web URL for email links:');
  console.log('   export CANVAS_WEB_URL="https://your-domain.com"');
  
  console.log('\n4. Generate secure JWT secret:');
  console.log('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'base64\'))"');
  console.log('   Update server/config/auth.json with the generated secret');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Canvas Server Email Verification Test\n');
  
  // Check if server is running
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/auth/config`);
    if (response.ok) {
      console.log('✅ Canvas server is running\n');
      await testEmailVerification();
    } else {
      console.log('❌ Canvas server is not responding properly');
      console.log('   Make sure the server is running on http://localhost:8001');
    }
  } catch (error) {
    console.log('❌ Cannot connect to Canvas server');
    console.log('   Make sure the server is running on http://localhost:8001');
    console.log(`   Error: ${error.message}`);
  }
  
  generateSampleTemplates();
  showConfigurationInstructions();
}

export { testEmailVerification, generateSampleTemplates, showConfigurationInstructions };