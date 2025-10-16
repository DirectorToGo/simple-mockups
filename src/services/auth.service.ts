import { Injectable, signal } from '@angular/core';

const AUTH_STORAGE_KEY = 'simple-mockups-authenticated';
const AUTH_PASSWORD = 'ConcourseSucks';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly _isAuthenticated = signal(this.restoreAuthState());

  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  login(password: string): boolean {
    const success = password === AUTH_PASSWORD;
    this._isAuthenticated.set(success);
    this.persistAuthState(success);
    return success;
  }

  logout(): void {
    this._isAuthenticated.set(false);
    this.persistAuthState(false);
  }

  private restoreAuthState(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
  }

  private persistAuthState(isAuthenticated: boolean): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, isAuthenticated ? 'true' : 'false');
  }
}
