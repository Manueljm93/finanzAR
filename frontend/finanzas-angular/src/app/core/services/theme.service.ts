import { Injectable, signal } from '@angular/core';

/**
 * Maneja el tema claro/oscuro intercambiando el href del <link id="app-theme">
 * (definido en index.html) y la clase `dark` en <html>. La preferencia se
 * guarda en localStorage y se aplica antes del render por un script inline.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'finanzas-theme';
  private readonly lightHref = 'themes/lara-light-blue/theme.css';
  private readonly darkHref = 'themes/lara-dark-blue/theme.css';

  readonly isDark = signal(this.readStored() === 'dark');

  constructor() {
    this.apply(this.isDark());
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    localStorage.setItem(this.storageKey, next ? 'dark' : 'light');
    this.apply(next);
  }

  private apply(dark: boolean): void {
    const link = document.getElementById('app-theme') as HTMLLinkElement | null;
    if (link) link.href = dark ? this.darkHref : this.lightHref;
    document.documentElement.classList.toggle('dark', dark);
  }

  private readStored(): string | null {
    return localStorage.getItem(this.storageKey);
  }
}
