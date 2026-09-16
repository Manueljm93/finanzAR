import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div *ngIf="auth.isLoggedIn(); else loginView">
      <nav class="navbar">
        <span class="brand"><i class="pi pi-wallet"></i> FinanzasAR</span>
        <div class="nav-links">
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/incomes" routerLinkActive="active">Ingresos</a>
          <a routerLink="/expenses" routerLinkActive="active">Gastos</a>
          <a routerLink="/vencimientos" routerLinkActive="active">Vencimientos</a>
          <a routerLink="/monotributo" routerLinkActive="active">Monotributo</a>
          <a routerLink="/entities" routerLinkActive="active">Entidades</a>
          <a routerLink="/reports" routerLinkActive="active">Reportes</a>
        </div>
        <button class="icon-btn" (click)="theme.toggle()"
          [title]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
          <i class="pi" [ngClass]="theme.isDark() ? 'pi-sun' : 'pi-moon'"></i>
        </button>
        <button (click)="auth.logout()" class="btn-logout">
          <i class="pi pi-sign-out"></i> Salir
        </button>
      </nav>
      <main class="page-container">
        <router-outlet />
      </main>
    </div>
    <ng-template #loginView>
      <router-outlet />
    </ng-template>
  `,
  styles: [`
    .navbar {
      display: flex;
      align-items: center;
      gap: 1rem;
      height: 60px;
      padding: 0 1.5rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-border);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: .5rem;
      font-weight: 700;
      font-size: 1.15rem;
      color: var(--text-color);
      margin-right: 1.25rem;
    }
    .brand i { color: var(--primary-color); }
    .nav-links { display: flex; gap: .25rem; margin-right: auto; }
    .nav-links a {
      color: var(--text-color-secondary);
      text-decoration: none;
      padding: .5rem .85rem;
      border-radius: 9px;
      font-weight: 500;
      font-size: .93rem;
      transition: background .15s, color .15s;
    }
    .nav-links a:hover { color: var(--text-color); background: var(--surface-hover); }
    .nav-links a.active { color: var(--highlight-text-color); background: var(--highlight-bg); }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 9px;
      background: transparent;
      border: 1px solid var(--surface-border);
      color: var(--text-color-secondary);
      cursor: pointer;
      transition: background .15s, color .15s;
    }
    .icon-btn:hover { background: var(--surface-hover); color: var(--text-color); }
    .btn-logout {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      background: transparent;
      border: 1px solid var(--surface-border);
      color: var(--text-color-secondary);
      padding: .5rem .9rem;
      border-radius: 9px;
      cursor: pointer;
      font-weight: 500;
      transition: background .15s, color .15s, border-color .15s;
    }
    .btn-logout:hover { background: var(--surface-hover); color: var(--red-500); border-color: var(--red-400); }
  `]
})
export class AppComponent {
  auth = inject(AuthService);
  theme = inject(ThemeService);
}
