-- Initialize Central Alerts Database
-- Run this once to set up your D1 database

CREATE TABLE IF NOT EXISTS central_alerts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('success', 'info', 'warning', 'danger')),
    dismissible BOOLEAN NOT NULL DEFAULT false,
    min_fossbilling_version TEXT NOT NULL,
    max_fossbilling_version TEXT NOT NULL,
    include_preview_branch BOOLEAN NOT NULL DEFAULT false,
    buttons JSON DEFAULT '[]',
    datetime TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_central_alerts_type ON central_alerts(type);
CREATE INDEX IF NOT EXISTS idx_central_alerts_version_range ON central_alerts(min_fossbilling_version, max_fossbilling_version);
CREATE INDEX IF NOT EXISTS idx_central_alerts_datetime ON central_alerts(datetime);

-- Insert sample data (delete these if you want to start empty)
INSERT OR IGNORE INTO central_alerts (id, title, message, type, dismissible, min_fossbilling_version, max_fossbilling_version, include_preview_branch, datetime, buttons) VALUES 
('1', 'This version of FOSSBilling is insecure', 'FOSSBilling versions older than 0.5.3 are vulnerable to SQL injection with a critical (9.8) severity. Please update now to protect you and your customers.', 'danger', false, '0.0.0', '0.5.2', false, '2023-06-30T21:43:03+00:00', 
'[{"text": "CVE Details", "link": "https://nvd.nist.gov/vuln/detail/CVE-2023-3490", "type": "info"}, {"text": "Original vulnerability report", "link": "https://huntr.dev/bounties/4e60ebc1-e00f-48cb-b011-3cefce688ecd/", "type": "info"}]');