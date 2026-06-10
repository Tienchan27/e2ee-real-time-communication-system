import React, { createContext, useCallback, useEffect, useState } from "react";
import type { User, AuthContext as AuthContextType } from "../types/index.js";
import { apiClient } from "../api/client.js";
import { socketManager } from "../socket/manager.js";

interface AuthContextValue extends AuthContextType {
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (
    email: string,
    username: string,
    password: string,
    displayName: string,
  ) => Promise<{
    otpRequestId: string;
    expiresInSec: number;
    cooldownSec: number;
  }>;
  verifyOtp: (otpRequestId: string, otpCode: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

const STORAGE_KEY_ACCESS_TOKEN = "auth:accessToken";
const STORAGE_KEY_REFRESH_TOKEN = "auth:refreshToken";
const STORAGE_KEY_USER = "auth:user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from storage on mount
  useEffect(() => {
    const storedAccessToken = localStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
    const storedRefreshToken = localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);

    if (storedAccessToken && storedUser) {
      try {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser));
        apiClient.setAccessToken(storedAccessToken);
      } catch (err) {
        console.error("Failed to load auth from storage:", err);
        localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    }

    setIsLoading(false);
  }, []);

  // Save to storage when auth changes
  useEffect(() => {
    if (accessToken && user) {
      localStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, accessToken);
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
      }
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      apiClient.setAccessToken(accessToken);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
      apiClient.setAccessToken(null);
    }
  }, [accessToken, user, refreshToken]);

  const login = useCallback(async (identifier: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        deviceName: `${navigator.platform} Browser`,
      };

      const response = await apiClient.login(identifier, password, deviceInfo);

      setUser(response.user);
      setAccessToken(response.accessToken);
      setRefreshToken(response.refreshToken);

      // Connect socket after login
      await socketManager.connect(response.accessToken);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);

    try {
      if (refreshToken) {
        await apiClient.logout(refreshToken);
      }
      socketManager.disconnect();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, [refreshToken]);

  const register = useCallback(
    async (
      email: string,
      username: string,
      password: string,
      displayName: string,
    ) => {
      setError(null);

      try {
        const response = await apiClient.requestOtp(
          email,
          username,
          password,
          displayName,
        );
        return response;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Registration failed";
        setError(errorMsg);
        throw err;
      }
    },
    [],
  );

  const verifyOtp = useCallback(async (otpRequestId: string, otpCode: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.verifyOtp({
        otpRequestId: otpRequestId as any,
        otpCode,
      });

      setUser(response.user);
      setAccessToken(response.accessToken);
      setRefreshToken(response.refreshToken);

      // Connect socket after registration
      await socketManager.connect(response.accessToken);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "OTP verification failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    refreshToken: refreshToken || null,
    isLoading,
    error,
    login,
    logout,
    register,
    verifyOtp,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
