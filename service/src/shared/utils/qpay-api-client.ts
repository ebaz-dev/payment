import axios, { AxiosResponse } from "axios";
import dotenv from "dotenv";

dotenv.config();

const { QPAY_BASE_URI, QPAY_USERNAME, QPAY_PASSWORD } = process.env;

export class QpayClient {
  public token: string | null = null;
  public tokenExpiration: Date | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(
    private baseUri: string = QPAY_BASE_URI!,
    private getTokenPath: string = "/auth/token",
    private username: string = QPAY_USERNAME!,
    private password: string = QPAY_PASSWORD!
  ) {
    this.scheduleTokenRefresh();
  }

  // Method to get a new token for the API
  public async getToken(): Promise<void> {
    try {
      const token = `${this.username}:${this.password}`;
      const encodedToken = Buffer.from(token).toString("base64");
      const headers = { Authorization: "Basic " + encodedToken };

      const response: AxiosResponse<{ access_token: string }> = await axios.post(
        `${this.baseUri}${this.getTokenPath}`,
        {}, // Empty body
        { headers }
      );

      this.token = response.data.access_token;

      // Set token expiration to 15 minutes from now
      this.tokenExpiration = new Date();
      this.tokenExpiration.setMinutes(this.tokenExpiration.getMinutes() + 15);

      console.log("New token acquired:", this.token);
    } catch (error) {
      console.error("Error getting token:", error);
      throw new Error("Failed to get token");
    }
  }

  // Method to check if the token is valid
  private isTokenValid(): boolean {
    if (!this.token || !this.tokenExpiration) {
      return false;
    }
    return new Date() < this.tokenExpiration;
  }

  // Helper method for making actual API requests
  public async post(path: string, data: any): Promise<AxiosResponse<any>> {
    // Check if the token is still valid, otherwise refresh it
    if (!this.isTokenValid()) {
      await this.getToken();
    }

    try {
      return await this.makeApiRequest(path, data);
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        // If a 401 is received, refresh the token and retry the request
        console.log("Received 401 Unauthorized, refreshing token...");
        await this.getToken();
        return this.makeApiRequest(path, data);
      }

      console.error("API request error:", error);
      throw error;
    }
  }

  // Helper method for making actual API requests
  private async makeApiRequest(
    path: string,
    data: any
  ): Promise<AxiosResponse<any>> {
    return await axios.post(`${this.baseUri}${path}`, data, {
      headers: { Authorization: `Bearer ${this.token}` },
      maxBodyLength: Infinity,
    });
  }

  // Automatically refresh the token every 15 minutes
  private scheduleTokenRefresh() {
    this.refreshInterval = setInterval(async () => {
      console.log("Refreshing QPay token...");
      await this.getToken();
    }, 14 * 60 * 1000);
  }
}
