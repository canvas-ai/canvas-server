'use strict';

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Email Service - Handles email sending for verification and password reset
 */
class EmailService {
  #transporter;
  #config;
  #initialized = false;

  constructor() {
    this.#config = null;
    this.#transporter = null;
  }

  /**
   * Initialize the email service
   */
  async initialize() {
    if (this.#initialized) return;

    try {
      // Load SMTP configuration
      const configPath = path.join(process.cwd(), 'server/config/smtp.json');
      if (!fs.existsSync(configPath)) {
        console.log('[EmailService] SMTP configuration not found, email service will be disabled');
        this.#initialized = true;
        return;
      }

      const configData = fs.readFileSync(configPath, 'utf8');
      this.#config = JSON.parse(configData);

      if (!this.#config.enabled) {
        console.log('[EmailService] Email service is disabled in configuration');
        this.#initialized = true;
        return;
      }

      // Create transporter
      await this.#createTransporter();
      console.log('[EmailService] Email service initialized successfully');
      this.#initialized = true;
    } catch (error) {
      console.error('[EmailService] Failed to initialize email service:', error.message);
      this.#initialized = true; // Mark as initialized to prevent retries
    }
  }

  /**
   * Create nodemailer transporter
   * @private
   */
  async #createTransporter() {
    if (this.#config.systemDefaults?.useSystemSMTP) {
      // Use system SMTP (sendmail, postfix, etc.)
      this.#transporter = nodemailer.createTransporter({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail'
      });
    } else {
      // Use configured SMTP server
      const smtpConfig = {
        host: this.#config.host,
        port: this.#config.port,
        secure: this.#config.secure,
        auth: this.#config.auth.user ? {
          user: this.#config.auth.user,
          pass: this.#config.auth.pass
        } : undefined
      };

      this.#transporter = nodemailer.createTransporter(smtpConfig);
    }

    // Verify connection
    try {
      await this.#transporter.verify();
      console.log('[EmailService] SMTP connection verified');
    } catch (error) {
      console.error('[EmailService] SMTP connection failed:', error.message);
      if (this.#config.systemDefaults?.fallbackToSystem && !this.#config.systemDefaults?.useSystemSMTP) {
        console.log('[EmailService] Falling back to system SMTP');
        this.#transporter = nodemailer.createTransporter({
          sendmail: true,
          newline: 'unix',
          path: '/usr/sbin/sendmail'
        });
      }
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable() {
    return this.#initialized && this.#transporter && this.#config?.enabled;
  }

  /**
   * Send email verification
   * @param {string} email - Recipient email
   * @param {string} verificationUrl - Verification URL
   * @param {string} userName - User's name
   * @returns {Promise<boolean>} - Success status
   */
  async sendVerificationEmail(email, verificationUrl, userName = '') {
    if (!this.isAvailable()) {
      console.warn('[EmailService] Email service not available, skipping verification email');
      return false;
    }

    try {
      const template = this.#config.templates.verification;
      const subject = template.subject;
      const html = template.html
        .replace('{verificationUrl}', verificationUrl)
        .replace('{userName}', userName);
      const text = template.text
        .replace('{verificationUrl}', verificationUrl)
        .replace('{userName}', userName);

      const mailOptions = {
        from: `"${this.#config.from.name}" <${this.#config.from.email}>`,
        to: email,
        subject: subject,
        html: html,
        text: text
      };

      await this.#transporter.sendMail(mailOptions);
      console.log(`[EmailService] Verification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error(`[EmailService] Failed to send verification email to ${email}:`, error.message);
      return false;
    }
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetUrl - Password reset URL
   * @param {string} userName - User's name
   * @returns {Promise<boolean>} - Success status
   */
  async sendPasswordResetEmail(email, resetUrl, userName = '') {
    if (!this.isAvailable()) {
      console.warn('[EmailService] Email service not available, skipping password reset email');
      return false;
    }

    try {
      const template = this.#config.templates.passwordReset;
      const subject = template.subject;
      const html = template.html
        .replace('{resetUrl}', resetUrl)
        .replace('{userName}', userName);
      const text = template.text
        .replace('{resetUrl}', resetUrl)
        .replace('{userName}', userName);

      const mailOptions = {
        from: `"${this.#config.from.name}" <${this.#config.from.email}>`,
        to: email,
        subject: subject,
        html: html,
        text: text
      };

      await this.#transporter.sendMail(mailOptions);
      console.log(`[EmailService] Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.error(`[EmailService] Failed to send password reset email to ${email}:`, error.message);
      return false;
    }
  }

  /**
   * Send custom email
   * @param {string} email - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML content
   * @param {string} text - Plain text content
   * @returns {Promise<boolean>} - Success status
   */
  async sendCustomEmail(email, subject, html, text) {
    if (!this.isAvailable()) {
      console.warn('[EmailService] Email service not available, skipping custom email');
      return false;
    }

    try {
      const mailOptions = {
        from: `"${this.#config.from.name}" <${this.#config.from.email}>`,
        to: email,
        subject: subject,
        html: html,
        text: text
      };

      await this.#transporter.sendMail(mailOptions);
      console.log(`[EmailService] Custom email sent to ${email}`);
      return true;
    } catch (error) {
      console.error(`[EmailService] Failed to send custom email to ${email}:`, error.message);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;