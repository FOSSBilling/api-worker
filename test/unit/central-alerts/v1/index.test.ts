/**
 * Tests for FOSSBilling API Worker - Central Alerts Service (v1)
 *
 * @license AGPL-3.0
 */

import { describe, it, expect } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import app from '../../../../src';
import { CentralAlerts } from '../../../../src/central-alerts/v1/data';

describe('Central Alerts API v1', () => {
  describe('GET /list', () => {
    it('should return list of central alerts', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveProperty('result');
      expect(data).toHaveProperty('error', null);
      expect(data.result).toHaveProperty('alerts');
      expect(Array.isArray(data.result.alerts)).toBe(true);
    });

    it('should return alerts from static data', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const data = await response.json();
      const alerts = data.result.alerts;

      // Should match the imported CentralAlerts data
      expect(alerts).toEqual(CentralAlerts);
      expect(alerts.length).toBe(CentralAlerts.length);
    });

    it('should return alerts with correct structure', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const data = await response.json();
      const alerts = data.result.alerts;

      // Verify each alert has required fields
      alerts.forEach((alert: any) => {
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('title');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('type');
        expect(alert).toHaveProperty('dismissible');
        expect(alert).toHaveProperty('min_fossbilling_version');
        expect(alert).toHaveProperty('max_fossbilling_version');
        expect(alert).toHaveProperty('include_preview_branch');
        expect(alert).toHaveProperty('datetime');

        // Verify type is one of the allowed values
        expect(['success', 'info', 'warning', 'danger']).toContain(alert.type);

        // Verify dismissible is boolean
        expect(typeof alert.dismissible).toBe('boolean');
      });
    });

    it('should include SQL injection vulnerability alert', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const data = await response.json();
      const alerts = data.result.alerts;

      // Should contain the SQL injection alert
      const sqlAlert = alerts.find((alert: any) => alert.id === '1');
      expect(sqlAlert).toBeTruthy();
      expect(sqlAlert.type).toBe('danger');
      expect(sqlAlert.message).toContain('SQL injection');
      expect(sqlAlert.max_fossbilling_version).toBe('0.5.2');
    });

    it('should include buttons in alerts when present', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const data = await response.json();
      const alerts = data.result.alerts;

      // SQL injection alert should have buttons
      const sqlAlert = alerts.find((alert: any) => alert.id === '1');
      expect(sqlAlert.buttons).toBeTruthy();
      expect(Array.isArray(sqlAlert.buttons)).toBe(true);
      expect(sqlAlert.buttons.length).toBeGreaterThan(0);

      // Verify button structure
      sqlAlert.buttons.forEach((button: any) => {
        expect(button).toHaveProperty('text');
        expect(button).toHaveProperty('link');
        expect(button.link).toMatch(/^https?:\/\//);
      });
    });

    it('should redirect trailing slash to non-trailing slash path', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list/', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Should redirect (301) to remove trailing slash
      expect(response.status).toBe(301);
      const location = response.headers.get('Location');
      expect(location).toContain('/central-alerts/v1/list');
      expect(location).not.toContain('/central-alerts/v1/list/');
    });

    it('should return consistent data on multiple requests', async () => {
      const ctx1 = createExecutionContext();
      const response1 = await app.request('/central-alerts/v1/list', {}, env, ctx1);
      await waitOnExecutionContext(ctx1);
      const data1 = await response1.json();

      const ctx2 = createExecutionContext();
      const response2 = await app.request('/central-alerts/v1/list', {}, env, ctx2);
      await waitOnExecutionContext(ctx2);
      const data2 = await response2.json();

      // Both responses should be identical
      expect(data1).toEqual(data2);
    });

    it('should return valid ISO 8601 datetime', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/list', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      const data = await response.json();
      const alerts = data.result.alerts;

      alerts.forEach((alert: any) => {
        // Verify datetime is valid ISO 8601 format
        const date = new Date(alert.datetime);
        expect(date.toString()).not.toBe('Invalid Date');
        expect(alert.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });
    });
  });

  describe('Error Cases', () => {
    it('should return 404 for unknown routes', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/unknown', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
    });

    it('should redirect root path with trailing slash', async () => {
      const ctx = createExecutionContext();
      const response = await app.request('/central-alerts/v1/', {}, env, ctx);
      await waitOnExecutionContext(ctx);

      // Should redirect (301) to remove trailing slash
      expect(response.status).toBe(301);
      const location = response.headers.get('Location');
      expect(location).toContain('/central-alerts/v1');
      expect(location).not.toContain('/central-alerts/v1/');
    });
  });
});
