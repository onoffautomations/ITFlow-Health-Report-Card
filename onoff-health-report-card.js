class OnOffHealthReportCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.showDetails = false;
    this.healthData = null;
    this.backupData = null;
    this.includeIntegrationList = false;
  }

  setConfig(config) {
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    }
    // Always reload health data when hass updates
    this.loadHealthData();
    this.loadBackupData();
  }

  async loadBackupData() {
    try {
      const backupData = {
        cloudBackup: null,
        googleDriveBackup: null,
        localBackupCount: 0
      };

      // Check Home Assistant Cloud Backup
      const cloudBackup = this._hass.states['binary_sensor.backups'];
      if (cloudBackup) {
        backupData.cloudBackup = {
          state: cloudBackup.state,
          lastBackup: cloudBackup.attributes?.last_backup || 'Unknown',
          count: cloudBackup.attributes?.backups || 0
        };
      }

      // Check Google Drive Backup addon
      for (const entity_id in this._hass.states) {
        if (entity_id.startsWith('sensor.') && entity_id.includes('backup') && entity_id.includes('google')) {
          const sensor = this._hass.states[entity_id];
          backupData.googleDriveBackup = {
            state: sensor.state,
            lastBackup: sensor.attributes?.last_backup || sensor.attributes?.friendly_name || 'Unknown',
            count: sensor.attributes?.backups || 0
          };
          break;
        }
      }

      // Check Local Backups
      for (const entity_id in this._hass.states) {
        if (entity_id.startsWith('sensor.') && entity_id.includes('backup')) {
          const sensor = this._hass.states[entity_id];
          const count = sensor.attributes?.backups || 0;
          backupData.localBackupCount = Math.max(backupData.localBackupCount, count);
        }
      }

      this.backupData = backupData;

      if (this.showDetails) {
        this.renderBackupDetails();
      }
    } catch (error) {
      console.error('Error loading backup data:', error);
    }
  }

  async loadHealthData() {
    try {
      // Get system health data from sensors - try different entity ID patterns
      let cpuSensor = this._hass.states['sensor.onoff_itflow_cpu_usage'];
      let memorySensor = this._hass.states['sensor.onoff_itflow_memory_usage'];
      let diskSensor = this._hass.states['sensor.onoff_itflow_disk_usage'];

      // If not found, try with the actual title
      if (!cpuSensor) {
        // Search for CPU sensor
        for (const entity_id in this._hass.states) {
          if (entity_id.includes('cpu_usage') && entity_id.startsWith('sensor.')) {
            cpuSensor = this._hass.states[entity_id];
            break;
          }
        }
      }

      if (!memorySensor) {
        for (const entity_id in this._hass.states) {
          if (entity_id.includes('memory_usage') && entity_id.startsWith('sensor.') && !entity_id.includes('free') && !entity_id.includes('total')) {
            memorySensor = this._hass.states[entity_id];
            break;
          }
        }
      }

      if (!diskSensor) {
        for (const entity_id in this._hass.states) {
          if (entity_id.includes('disk_usage') && entity_id.startsWith('sensor.') && !entity_id.includes('free') && !entity_id.includes('total')) {
            diskSensor = this._hass.states[entity_id];
            break;
          }
        }
      }

      this.healthData = {
        cpu: cpuSensor ? parseFloat(cpuSensor.state) : 0,
        memory: memorySensor ? parseFloat(memorySensor.state) : 0,
        disk: diskSensor ? parseFloat(diskSensor.state) : 0,
        entities: Object.keys(this._hass.states).length,
        version: this._hass.config.version
      };

      if (this.showDetails) {
        this.renderHealthDetails();
      }
    } catch (error) {
      console.error('Error loading health data:', error);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: 16px;
          background: linear-gradient(135deg, #8E44AD 0%, #9B59B6 100%);
          color: white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
          margin-bottom: 16px;
        }
        .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .description {
          font-size: 14px;
          opacity: 0.95;
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .button-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .report-btn {
          flex: 1;
          padding: 16px;
          background: rgba(255,255,255,0.25);
          border: 2px solid white;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .report-btn:hover {
          background: rgba(255,255,255,0.35);
          transform: translateY(-2px);
        }
        .report-btn:active {
          transform: translateY(0);
        }
        .report-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .toggle-btn {
          flex: 1;
          padding: 16px;
          background: rgba(255,255,255,0.15);
          border: 2px solid white;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .toggle-btn:hover {
          background: rgba(255,255,255,0.25);
        }
        .toggle-btn.active {
          background: rgba(255,255,255,0.35);
        }
        .success-message {
          background: rgba(76, 175, 80, 0.9);
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
          display: none;
        }
        .error-message {
          background: rgba(244, 67, 54, 0.9);
          padding: 12px;
          border-radius: 6px;
          margin-top: 12px;
          display: none;
        }
        .spinner {
          border: 3px solid rgba(255,255,255,0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
          display: none;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .health-details {
          background: rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
          display: none;
        }
        .health-details.visible {
          display: block;
        }
        .health-item {
          margin-bottom: 12px;
        }
        .health-label {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .health-bar {
          background: rgba(255,255,255,0.3);
          border-radius: 4px;
          height: 24px;
          overflow: hidden;
          position: relative;
        }
        .health-bar-fill {
          background: rgba(255,255,255,0.9);
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #333;
          transition: width 0.3s;
        }
        .health-bar-fill.warning {
          background: #ff9800;
          color: white;
        }
        .health-bar-fill.critical {
          background: #f44336;
          color: white;
        }
        .health-info {
          font-size: 14px;
          margin-top: 8px;
        }
        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: rgba(255,255,255,0.15);
          border-radius: 6px;
          margin-top: 12px;
        }
        .checkbox-container input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }
        .checkbox-container label {
          cursor: pointer;
          font-size: 14px;
          user-select: none;
        }
        .backup-item {
          margin-bottom: 12px;
          padding: 12px;
          background: rgba(255,255,255,0.1);
          border-radius: 6px;
        }
        .backup-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .status-icon {
          font-size: 20px;
        }
        .backup-details {
          font-size: 12px;
          opacity: 0.9;
          margin-left: 28px;
        }
        .section-divider {
          height: 2px;
          background: rgba(255,255,255,0.3);
          margin: 16px 0;
        }
        .section-title {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 12px;
        }
      </style>
      <ha-card>
        <div class="header">
          <h2>📊 Health Report</h2>
        </div>
        <div class="description">
          Generate and send comprehensive health and backup reports including system resources, entity counts, automations, and backup status.
        </div>
        <div class="button-row">
          <button class="report-btn" id="send-health-report-btn">
            <span id="health-btn-text">Send Health Report</span>
            <div class="spinner" id="health-spinner"></div>
          </button>
          <button class="report-btn" id="send-backup-report-btn">
            <span id="backup-btn-text">Send Backup Report</span>
            <div class="spinner" id="backup-spinner"></div>
          </button>
        </div>
        <div class="button-row">
          <button class="toggle-btn" id="toggle-details-btn">
            Show Details
          </button>
        </div>
        <div class="checkbox-container">
          <input type="checkbox" id="force-send-backup" />
          <label for="force-send-backup">Force send backup report even if backups are healthy</label>
        </div>
        <div class="health-details" id="health-details">
          <div class="health-item">
            <div class="health-label">CPU Usage</div>
            <div class="health-bar">
              <div class="health-bar-fill" id="cpu-bar" style="width: 0%">0%</div>
            </div>
          </div>
          <div class="health-item">
            <div class="health-label">Memory Usage</div>
            <div class="health-bar">
              <div class="health-bar-fill" id="memory-bar" style="width: 0%">0%</div>
            </div>
          </div>
          <div class="health-item">
            <div class="health-label">Disk Usage</div>
            <div class="health-bar">
              <div class="health-bar-fill" id="disk-bar" style="width: 0%">0%</div>
            </div>
          </div>
          <div class="health-info">
            <strong>Total Entities:</strong> <span id="entities-count">0</span><br>
            <strong>HA Version:</strong> <span id="ha-version">Unknown</span>
          </div>
          <div class="section-divider"></div>
          <div class="section-title">💾 Backup Status</div>
          <div class="backup-item" id="cloud-backup-item">
            <div class="backup-status">
              <span class="status-icon" id="cloud-backup-icon">⏳</span>
              <strong>Home Assistant Cloud</strong>
            </div>
            <div class="backup-details" id="cloud-backup-details">Checking...</div>
          </div>
          <div class="backup-item" id="google-backup-item">
            <div class="backup-status">
              <span class="status-icon" id="google-backup-icon">⏳</span>
              <strong>Google Drive Backup</strong>
            </div>
            <div class="backup-details" id="google-backup-details">Checking...</div>
          </div>
          <div class="backup-item" id="local-backup-item">
            <div class="backup-status">
              <span class="status-icon" id="local-backup-icon">⏳</span>
              <strong>Local Backups</strong>
            </div>
            <div class="backup-details" id="local-backup-details">Checking...</div>
          </div>
        </div>
        <div class="success-message" id="success-msg">✓ Report sent successfully!</div>
        <div class="error-message" id="error-msg">✗ Failed to send report. Please try again.</div>
      </ha-card>
    `;

    const sendHealthBtn = this.shadowRoot.getElementById('send-health-report-btn');
    sendHealthBtn.addEventListener('click', () => this.handleSendHealthReport());

    const sendBackupBtn = this.shadowRoot.getElementById('send-backup-report-btn');
    sendBackupBtn.addEventListener('click', () => this.handleSendBackupReport());

    const toggleBtn = this.shadowRoot.getElementById('toggle-details-btn');
    toggleBtn.addEventListener('click', () => this.toggleDetails());
  }

  toggleDetails() {
    this.showDetails = !this.showDetails;
    const detailsDiv = this.shadowRoot.getElementById('health-details');
    const toggleBtn = this.shadowRoot.getElementById('toggle-details-btn');

    if (this.showDetails) {
      detailsDiv.classList.add('visible');
      toggleBtn.classList.add('active');
      toggleBtn.textContent = 'Hide Details';
      this.renderHealthDetails();
      this.renderBackupDetails();
    } else {
      detailsDiv.classList.remove('visible');
      toggleBtn.classList.remove('active');
      toggleBtn.textContent = 'Show Details';
    }
  }

  renderHealthDetails() {
    if (!this.healthData) {
      this.loadHealthData();
      return;
    }

    const cpuBar = this.shadowRoot.getElementById('cpu-bar');
    const memoryBar = this.shadowRoot.getElementById('memory-bar');
    const diskBar = this.shadowRoot.getElementById('disk-bar');
    const entitiesCount = this.shadowRoot.getElementById('entities-count');
    const haVersion = this.shadowRoot.getElementById('ha-version');

    // Update CPU bar
    cpuBar.style.width = `${this.healthData.cpu}%`;
    cpuBar.textContent = `${this.healthData.cpu}%`;
    cpuBar.className = 'health-bar-fill';
    if (this.healthData.cpu >= 90) cpuBar.classList.add('critical');
    else if (this.healthData.cpu >= 70) cpuBar.classList.add('warning');

    // Update Memory bar
    memoryBar.style.width = `${this.healthData.memory}%`;
    memoryBar.textContent = `${this.healthData.memory}%`;
    memoryBar.className = 'health-bar-fill';
    if (this.healthData.memory >= 90) memoryBar.classList.add('critical');
    else if (this.healthData.memory >= 70) memoryBar.classList.add('warning');

    // Update Disk bar
    diskBar.style.width = `${this.healthData.disk}%`;
    diskBar.textContent = `${this.healthData.disk}%`;
    diskBar.className = 'health-bar-fill';
    if (this.healthData.disk >= 90) diskBar.classList.add('critical');
    else if (this.healthData.disk >= 70) diskBar.classList.add('warning');

    // Update other info
    entitiesCount.textContent = this.healthData.entities;
    haVersion.textContent = this.healthData.version;
  }

  renderBackupDetails() {
    if (!this.backupData) {
      this.loadBackupData();
      return;
    }

    // Cloud Backup
    const cloudIcon = this.shadowRoot.getElementById('cloud-backup-icon');
    const cloudDetails = this.shadowRoot.getElementById('cloud-backup-details');
    if (this.backupData.cloudBackup) {
      if (this.backupData.cloudBackup.state === 'on') {
        cloudIcon.textContent = '✅';
        cloudDetails.innerHTML = `Active | ${this.backupData.cloudBackup.count} backups | Last: ${this.backupData.cloudBackup.lastBackup}`;
      } else {
        cloudIcon.textContent = '❌';
        cloudDetails.innerHTML = 'No recent backups detected';
      }
    } else {
      cloudIcon.textContent = '❓';
      cloudDetails.innerHTML = 'Not configured or sensor not found';
    }

    // Google Drive Backup
    const googleIcon = this.shadowRoot.getElementById('google-backup-icon');
    const googleDetails = this.shadowRoot.getElementById('google-backup-details');
    if (this.backupData.googleDriveBackup) {
      googleIcon.textContent = '✅';
      googleDetails.innerHTML = `Active | ${this.backupData.googleDriveBackup.count} backups | Last: ${this.backupData.googleDriveBackup.lastBackup}`;
    } else {
      googleIcon.textContent = '❓';
      googleDetails.innerHTML = 'Not configured or sensor not found';
    }

    // Local Backups
    const localIcon = this.shadowRoot.getElementById('local-backup-icon');
    const localDetails = this.shadowRoot.getElementById('local-backup-details');
    if (this.backupData.localBackupCount > 0) {
      localIcon.textContent = '✅';
      localDetails.innerHTML = `${this.backupData.localBackupCount} local backups found`;
    } else {
      localIcon.textContent = '❌';
      localDetails.innerHTML = 'No local backups found';
    }
  }

  async handleSendHealthReport() {
    const btn = this.shadowRoot.getElementById('send-health-report-btn');
    const btnText = this.shadowRoot.getElementById('health-btn-text');
    const spinner = this.shadowRoot.getElementById('health-spinner');
    const successMsg = this.shadowRoot.getElementById('success-msg');
    const errorMsg = this.shadowRoot.getElementById('error-msg');

    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';

    // Show spinner
    btnText.style.display = 'none';
    spinner.style.display = 'block';
    btn.disabled = true;

    try {
      await this._hass.callService('onoff_itflow', 'send_health_report', {});

      successMsg.style.display = 'block';

      // Hide success message after 5 seconds
      setTimeout(() => {
        successMsg.style.display = 'none';
      }, 5000);

    } catch (error) {
      console.error('Error sending health report:', error);
      errorMsg.style.display = 'block';
      errorMsg.textContent = `✗ Error: ${error.message || 'Failed to send health report'}`;
      setTimeout(() => {
        errorMsg.style.display = 'none';
      }, 5000);
    } finally {
      // Hide spinner
      btnText.style.display = 'inline';
      spinner.style.display = 'none';
      btn.disabled = false;
    }
  }

  async handleSendBackupReport() {
    const btn = this.shadowRoot.getElementById('send-backup-report-btn');
    const btnText = this.shadowRoot.getElementById('backup-btn-text');
    const spinner = this.shadowRoot.getElementById('backup-spinner');
    const successMsg = this.shadowRoot.getElementById('success-msg');
    const errorMsg = this.shadowRoot.getElementById('error-msg');
    const forceSend = this.shadowRoot.getElementById('force-send-backup').checked;

    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';

    // Show spinner
    btnText.style.display = 'none';
    spinner.style.display = 'block';
    btn.disabled = true;

    try {
      await this._hass.callService('onoff_itflow', 'send_backup_check_report', {
        force_send: forceSend
      });

      successMsg.style.display = 'block';

      // Hide success message after 5 seconds
      setTimeout(() => {
        successMsg.style.display = 'none';
      }, 5000);

    } catch (error) {
      console.error('Error sending backup report:', error);
      errorMsg.style.display = 'block';
      errorMsg.textContent = `✗ Error: ${error.message || 'Failed to send backup report'}`;
      setTimeout(() => {
        errorMsg.style.display = 'none';
      }, 5000);
    } finally {
      // Hide spinner
      btnText.style.display = 'inline';
      spinner.style.display = 'none';
      btn.disabled = false;
    }
  }

  getCardSize() {
    return this.showDetails ? 4 : 2;
  }

  static getConfigElement() {
    return document.createElement('onoff-health-report-card-editor');
  }

  static getStubConfig() {
    return {};
  }
}

// Visual Editor
class OnOffHealthReportCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this.render();
  }

  render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }

    this.shadowRoot.innerHTML = `
      <style>
        .config-info {
          padding: 16px;
          background: #f5f5f5;
          border-radius: 4px;
        }
      </style>
      <div class="config-info">
        <p><strong>OnOff Health Report Card</strong></p>
        <p>This card has no configuration options. It uses the OnOff ITFlow integration to send health reports.</p>
      </div>
    `;
  }
}

customElements.define('onoff-health-report-card', OnOffHealthReportCard);
customElements.define('onoff-health-report-card-editor', OnOffHealthReportCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'onoff-health-report-card',
  name: 'OnOff Health Report Card',
  description: 'Send health reports to support and view system health',
  preview: true,
});
