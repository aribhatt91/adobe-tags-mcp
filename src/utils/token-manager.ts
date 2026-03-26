import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Adobe IMS Token Manager
 * Automatically refreshes access tokens before expiry
 */
export class TokenManager {
  private clientId: string;
  private clientSecret: string;
  private scope: string;
  private tokenFilePath: string;
  private currentToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(clientId: string, clientSecret: string, tokenFilePath?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.scope = /* process.env.ADOBE_IO_SCOPES || */ 'openid,AdobeID,target_sdk,additional_info.projectedProductContext,read_organizations,additional_info.roles,additional_info.job_function';
    
    // Store token in user's home directory
    this.tokenFilePath = tokenFilePath || path.join(
      process.env.HOME || process.env.USERPROFILE || '/tmp',
      '.adobe-launch-mcp-token.json'
    );
  }

  /**
   * Get valid access token (auto-refreshes if needed)
   */
  async getToken(): Promise<string> {
    // Check if current token is still valid (with 5 min buffer)
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    
    if (this.currentToken && now < (this.tokenExpiry - bufferMs)) {
      return this.currentToken;
    }

    // Token expired or doesn't exist - refresh
    return await this.refreshToken();
  }

  /**
   * Refresh access token from Adobe IMS
   */
  private async refreshToken(): Promise<string> {
    try {
      console.error('🔄 Refreshing Adobe access token...', this.clientId, this.clientSecret);

      const response = await axios.post(
        'https://ims-na1.adobelogin.com/ims/token/v2',
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: this.scope
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, expires_in } = response.data;

      // Store token and expiry time
      this.currentToken = access_token;
      this.tokenExpiry = Date.now() + (expires_in * 1000);

      // Save to disk for persistence across restarts
      await this.saveTokenToFile({
        token: access_token,
        expiry: this.tokenExpiry,
        refreshedAt: new Date().toISOString()
      });

      // Schedule next refresh (refresh 1 hour before expiry)
      this.scheduleNextRefresh(expires_in);

      console.error(`✅ Token refreshed. Valid for ${expires_in / 3600} hours`);

      return access_token;
    } catch (error: any) {
      console.error('Failed to refresh token:', error.response?.data || error.message);
      throw new Error('Token refresh failed: ' + (error.response?.data?.error_description || error.message));
    }
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleNextRefresh(expiresIn: number): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh 1 hour before expiry (or halfway through if token is <2 hours)
    const refreshBeforeExpiry = Math.min(3600, expiresIn / 2);
    const refreshIn = (expiresIn - refreshBeforeExpiry) * 1000;

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshToken();
      } catch (error) {
        //console.error('⚠️ Scheduled token refresh failed:', error);
        // Retry in 5 minutes
        setTimeout(() => this.refreshToken(), 5 * 60 * 1000);
      }
    }, refreshIn);

    const refreshTime = new Date(Date.now() + refreshIn);
    //console.error(`⏰ Next token refresh scheduled for: ${refreshTime.toISOString()}`);
  }

  /**
   * Load token from file (persists across restarts)
   */
  async loadTokenFromFile(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.tokenFilePath)) {
        return false;
      }

      const data = JSON.parse(fs.readFileSync(this.tokenFilePath, 'utf-8'));
      
      // Check if token is still valid
      const now = Date.now();
      if (now < data.expiry - (5 * 60 * 1000)) {
        this.currentToken = data.token;
        this.tokenExpiry = data.expiry;
        
        const remainingSeconds = Math.floor((data.expiry - now) / 1000);
        //console.error(`✅ Loaded cached token. Valid for ${remainingSeconds / 3600} more hours`);
        
        // Schedule next refresh
        this.scheduleNextRefresh(remainingSeconds);
        
        return true;
      } else {
        //console.error('⚠️ Cached token expired, will refresh');
        return false;
      }
    } catch (error) {
      //console.error('⚠️ Could not load cached token:', error);
      return false;
    }
  }

  /**
   * Save token to file for persistence
   */
  private async saveTokenToFile(data: any): Promise<void> {
    try {
      fs.writeFileSync(
        this.tokenFilePath,
        JSON.stringify(data, null, 2),
        { mode: 0o600 } // Only readable by owner
      );
    } catch (error) {
      //console.error('⚠️ Could not save token to file:', error);
    }
  }

  /**
   * Initialize token manager (try to load cached, otherwise refresh)
   */
  async initialize(): Promise<void> {
    const loaded = await this.loadTokenFromFile();
    if (!loaded) {
      await this.refreshToken();
    }
  }

  /**
   * Clean up (cancel scheduled refresh)
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}