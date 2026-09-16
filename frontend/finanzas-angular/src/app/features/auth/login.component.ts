import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, CardModule, MessageModule],
  template: `
    <div class="login-shell">
      <button class="login-toggle" type="button" (click)="theme.toggle()"
        [title]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
        <i class="pi" [ngClass]="theme.isDark() ? 'pi-sun' : 'pi-moon'"></i>
      </button>

      <p-card [style]="{'width':'400px'}">
        <div class="text-center mb-4">
          <i class="pi pi-wallet" style="font-size:2.2rem; color:var(--primary-color)"></i>
          <h1 class="login-title">FinanzasAR</h1>
          <p class="text-color-secondary mt-1 mb-0">Gestión financiera para monotributistas</p>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="flex flex-column gap-3">
            <div class="flex flex-column gap-1">
              <label for="email">Email</label>
              <input pInputText id="email" formControlName="email" type="email" placeholder="tu@email.com" />
            </div>
            <div class="flex flex-column gap-1">
              <label for="password">Contraseña</label>
              <input pInputText id="password" formControlName="password" type="password" />
            </div>
            <p-message *ngIf="error" severity="error" [text]="error"></p-message>
            <p-button
              type="submit"
              label="Ingresar"
              [loading]="loading"
              [disabled]="form.invalid"
              styleClass="w-full">
            </p-button>
          </div>
        </form>
      </p-card>
    </div>
  `,
  styles: [`
    .login-shell {
      position: relative;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: var(--surface-ground);
    }
    .login-title { font-size: 1.6rem; font-weight: 700; margin: .6rem 0 0; color: var(--text-color); }
    .login-toggle {
      position: fixed;
      top: 1rem;
      right: 1rem;
      width: 40px;
      height: 40px;
      border-radius: 9px;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      color: var(--text-color-secondary);
      cursor: pointer;
    }
    .login-toggle:hover { background: var(--surface-hover); color: var(--text-color); }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  theme = inject(ThemeService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  loading = false;
  error = '';

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: () => {
        this.error = 'Credenciales incorrectas.';
        this.loading = false;
      }
    });
  }
}
