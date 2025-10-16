import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 space-y-6">
        <div class="text-center space-y-1">
          <div class="mx-auto h-12 w-12 rounded-xl bg-pink-600 text-white flex items-center justify-center text-xl font-semibold">
            S
          </div>
          <h1 class="text-xl font-semibold text-gray-900">Simple Mock Ups</h1>
          <p class="text-sm text-gray-500">Enter the password to continue.</p>
        </div>
        <form class="space-y-4" (ngSubmit)="onSubmit()">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              [(ngModel)]="password"
              (input)="clearError()"
              autocomplete="current-password"
              required
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Enter password" />
          </div>
          @if (loginError()) {
            <p class="text-sm text-red-600">Incorrect password. Please try again.</p>
          }
          <button
            type="submit"
            class="w-full inline-flex justify-center items-center rounded-lg bg-pink-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500">
            Enter
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  password = '';
  readonly loginError = signal(false);

  constructor(private readonly authService: AuthService) {}

  onSubmit(): void {
    if (this.authService.login(this.password)) {
      this.loginError.set(false);
      this.password = '';
    } else {
      this.loginError.set(true);
    }
  }

  clearError(): void {
    if (this.loginError()) {
      this.loginError.set(false);
    }
  }
}
