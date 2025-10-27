/**
 * FOSSBilling Version Information Interface
 * 
 * Defines the structure for FOSSBilling version details,
 * including version number and support status.
 * 
 * @license AGPL-3.0
 */

export type FOSSBillingVersion = {
    version: string;
    support: 'insecure' | 'outdated' | 'latest';
};