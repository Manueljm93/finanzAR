import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'incomes',
    loadComponent: () => import('./features/incomes/incomes.component').then(m => m.IncomesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'expenses',
    loadComponent: () => import('./features/expenses/expenses.component').then(m => m.ExpensesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'vencimientos',
    loadComponent: () => import('./features/vencimientos/vencimientos.component').then(m => m.VencimientosComponent),
    canActivate: [authGuard]
  },
  {
    path: 'monotributo',
    loadComponent: () => import('./features/monotributo/monotributo.component').then(m => m.MonotributoComponent),
    canActivate: [authGuard]
  },
  {
    path: 'entities',
    loadComponent: () => import('./features/entities/entities.component').then(m => m.EntitiesComponent),
    canActivate: [authGuard]
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: 'dashboard' }
];
